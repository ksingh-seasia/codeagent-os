from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
import asyncio
from pydantic import BaseModel
import redis.asyncio as aioredis
import json
import uuid
import base64
from datetime import datetime, timedelta
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
import math
import httpx
from urllib.parse import urlparse
from app.core.config import settings
from app.db.session import get_db
from app.api.auth import get_current_user
from app.models.domain import User, Company, Execution, ExecutionStep, ExecutionFile
from app.services.super_admin import get_or_create_platform_settings
from app.core.security import encrypt_token, decrypt_token

router = APIRouter()

class ExecutionRequest(BaseModel):
    ticket_id: str
    requirement: str
    base_branch: str = "dev"
    target_repo: str = None
    ticket_type: str = "Task"

@router.post("/executions")
async def execute_agent(
    req: ExecutionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.company_id:
        raise HTTPException(status_code=403, detail="User does not belong to a tenant organization")

    # 1. Check Tenant Status & Quotas
    comp_result = await db.execute(select(Company).where(Company.id == current_user.company_id))
    company = comp_result.scalars().first()
    
    platform_settings = await get_or_create_platform_settings(db)
    
    if platform_settings.auto_suspend_billing and company.status == "SUSPENDED":
        raise HTTPException(status_code=403, detail="Tenant execution disabled due to billing suspension lapse.")

    # Mock checking run cap usage (e.g. counting executions in DB for this month)
    # If executions >= company.run_cap, block it.
    # For the threshold warning:
    threshold_str = platform_settings.quota_threshold.replace('%', '')
    threshold_pct = int(threshold_str) if threshold_str.isdigit() else 90
    # if usage > (company.run_cap * threshold_pct / 100):
    #    print(f"WARNING: Tenant {company.name} has exceeded the {threshold_pct}% quota threshold.")

    # 1.1 Verify Anthropic API Key
    if not current_user.anthropic_api_key:
        raise HTTPException(
            status_code=400,
            detail="Anthropic API key is not configured. Please connect your Anthropic API key in Integrations before executing the AI agent."
        )

    # Connect to redis
    redis_client = aioredis.Redis.from_url(settings.REDIS_URL)
    
    # 1.5 Create Execution DB record
    new_execution = Execution(
        user_id=current_user.id,
        company_id=company.id,
        jira_ticket_id=req.ticket_id,
        github_repository=req.target_repo,
        branch_name=req.base_branch,
        status="PENDING",
        started_at=datetime.utcnow()
    )
    db.add(new_execution)
    await db.commit()
    await db.refresh(new_execution)

    # Push job to queue for langgraph worker
    job_data = {
        "execution_id": new_execution.id,
        "ticket_id": req.ticket_id,
        "requirement": req.requirement,
        "base_branch": req.base_branch,
        "target_repo": req.target_repo,
        "ticket_type": req.ticket_type,
        "github_token": decrypt_token(current_user.github_token),
        "anthropic_api_key": decrypt_token(current_user.anthropic_api_key),
        "tenant_id": company.id,
        "tenant_domain": company.domain,
        # 2. Inject Circuit Breaker guardrail for the LangGraph execution loop
        "circuit_breaker_enabled": platform_settings.circuit_breaker
    }
    
    try:
        await redis_client.lpush('agent_jobs', json.dumps(job_data))
        
        # Transition Jira to "In Progress"
        import asyncio
        asyncio.create_task(transition_jira_issue(current_user, req.ticket_id, "In Progress", "🚀 Autonomous Agent Execution Started."))
        
        return {"status": "Job queued successfully", "ticket_id": req.ticket_id, "execution_id": new_execution.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await redis_client.close()

class FailRequest(BaseModel):
    error_message: str

@router.post("/executions/{ticket_id}/fail")
async def fail_agent(
    ticket_id: str,
    req: FailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Find execution and mark as FAILED
    result = await db.execute(
        select(Execution).where(Execution.jira_ticket_id == ticket_id).order_by(Execution.created_at.desc()).limit(1)
    )
    execution = result.scalars().first()
    if execution:
        execution.status = "FAILED"
        execution.error = req.error_message
        execution.completed_at = datetime.utcnow()
        await db.commit()
    
    # Transition Jira ticket back to To Do or open, and leave a comment
    comment = f"⚠️ Autonomous Agent Execution Failed.\n\nError Details: {req.error_message}\n\nPlease review the trace logs in the Developer Portal."
    import asyncio
    asyncio.create_task(transition_jira_issue(current_user, ticket_id, "To Do", comment))
    
    # Broadcast error event on Redis so UI immediately resets
    try:
        redis_client = aioredis.Redis.from_url(settings.REDIS_URL)
        await redis_client.publish("ui_updates", json.dumps({
            "ticket_id": ticket_id,
            "event_type": "error",
            "node": "operator_cancel" if "cancel" in req.error_message.lower() else "worker",
            "payload": req.error_message
        }))
        await redis_client.close()
    except Exception as re:
        print(f"Redis publish error in fail_agent: {re}")

    return {"status": "Execution failed and Jira ticket updated to To Do."}

class ResumeRequest(BaseModel):
    decision: str
    feedback: str = None
    target_repo: str = None
    base_branch: str = None
    ticket_type: str = "Task"

@router.post("/executions/{ticket_id}/resume")
async def resume_agent(
    ticket_id: str,
    req: ResumeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Find execution ID
    result = await db.execute(
        select(Execution).where(Execution.jira_ticket_id == ticket_id).order_by(Execution.created_at.desc()).limit(1)
    )
    execution = result.scalars().first()
    
    redis_client = aioredis.Redis.from_url(settings.REDIS_URL)
    job_data = {
        "ticket_id": ticket_id,
        "execution_id": execution.id if execution else None,
        "decision": req.decision,
        "feedback": req.feedback,
        "github_token": decrypt_token(current_user.github_token),
        "anthropic_api_key": decrypt_token(current_user.anthropic_api_key) if current_user.anthropic_api_key else None,
        "target_repo": req.target_repo,
        "base_branch": req.base_branch,
        "ticket_type": req.ticket_type
    }
    try:
        await redis_client.lpush('agent_resume_jobs', json.dumps(job_data))
        return {"status": "Resume job queued successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await redis_client.close()

@router.get("/executions/history")
async def get_execution_history(
    page: int = 1,
    limit: int = 50,
    time_filter: str = "all",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.company_id:
        return {"data": [], "meta": {"currentPage": page, "totalPages": 0, "totalRecords": 0, "hasMore": False}}
        
    now = datetime.utcnow()
    if time_filter == "7days":
        start_date = now - timedelta(days=7)
    elif time_filter == "custom":
        start_date = now - timedelta(days=30)
    elif time_filter == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = datetime.min
        
    count_result = await db.execute(
        select(func.count(Execution.id))
        .where(Execution.user_id == current_user.id)
        .where(Execution.created_at >= start_date)
    )
    total_records = count_result.scalar() or 0
    
    offset = (page - 1) * limit
    result = await db.execute(
        select(Execution, User.email)
        .outerjoin(User, Execution.user_id == User.id)
        .where(Execution.user_id == current_user.id)
        .where(Execution.created_at >= start_date)
        .order_by(Execution.created_at.desc())
        .offset(offset).limit(limit)
    )
    executions_with_user = result.all()
    executions = [r[0] for r in executions_with_user]
    user_emails = {r[0].id: (r[1] or current_user.email) for r in executions_with_user}
    
    # Extract unique GitHub PR API URLs to fetch live statuses
    github_token = decrypt_token(current_user.github_token) if current_user.github_token else None
    pr_api_urls = {}
    for ex in executions:
        if ex.pull_request_url and "github.com" in ex.pull_request_url:
            # e.g., https://github.com/ksingh123456789/ai-knowledge-assistant/pull/1
            parts = ex.pull_request_url.rstrip("/").split("/")
            if len(parts) >= 7 and parts[-2] == "pull":
                owner = parts[-4]
                repo = parts[-3]
                pr_num = parts[-1]
                api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_num}"
                pr_api_urls[ex.id] = api_url

    pr_statuses = {}
    if github_token and pr_api_urls:
        async with httpx.AsyncClient() as client:
            headers = {
                "Authorization": f"Bearer {github_token}",
                "Accept": "application/vnd.github.v3+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
            
            async def fetch_pr_status(exec_id, url):
                try:
                    resp = await client.get(url, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        state = data.get("state")
                        merged = data.get("merged", False)
                        if merged:
                            return exec_id, "Merged"
                        elif state == "closed":
                            return exec_id, "Closed"
                        elif state == "open":
                            return exec_id, "PR Open"
                except Exception:
                    pass
                return exec_id, None
            
            tasks = [fetch_pr_status(eid, url) for eid, url in pr_api_urls.items()]
            results = await asyncio.gather(*tasks)
            for eid, status in results:
                if status:
                    pr_statuses[eid] = status
    
    execution_ids = [ex.id for ex in executions]
    steps_by_exec = {eid: [] for eid in execution_ids}
    files_by_exec = {eid: [] for eid in execution_ids}
    
    if execution_ids:
        steps_result = await db.execute(select(ExecutionStep).where(ExecutionStep.execution_id.in_(execution_ids)).order_by(ExecutionStep.id))
        for s in steps_result.scalars().all():
            steps_by_exec[s.execution_id].append(s)
            
        files_result = await db.execute(select(ExecutionFile).where(ExecutionFile.execution_id.in_(execution_ids)).order_by(ExecutionFile.id))
        for f in files_result.scalars().all():
            files_by_exec[f.execution_id].append(f)
    
    # Map DB executions to frontend expected format
    history = []
    for ex in executions:
        duration_str = "0s"
        if ex.started_at and ex.completed_at:
            duration_str = f"{(ex.completed_at - ex.started_at).total_seconds():.1f}s"
        
        status_map = {
            "PENDING": "In Progress",
            "RUNNING": "In Progress",
            "COMPLETED": "Completed",
            "FAILED": "Failed",
            "NEEDS_REVIEW": "Needs Review"
        }
        
        step_breakdown = [
            {"name": s.name, "latency": s.latency, "tokens": s.tokens, "detail": s.detail}
            for s in steps_by_exec.get(ex.id, [])
        ]
        
        files_list = [
            {"name": f.name, "added": f.added_lines, "deleted": f.deleted_lines, "description": f.description}
            for f in files_by_exec.get(ex.id, [])
        ]
        
        db_status = status_map.get(ex.status, "In Progress")
        live_pr_status = pr_statuses.get(ex.id)
        
        # If the PR was created (we have a live PR status or it's mapped to Completed)
        # Force the status to show success even if the database had marked it as Failed.
        if live_pr_status:
            final_status = live_pr_status
        elif ex.pull_request_url:
            final_status = "Completed"
        else:
            final_status = db_status
        
        history.append({
            "id": f"exec-{ex.id}",
            "ticketKey": ex.jira_ticket_id,
            "targetRepo": ex.github_repository,
            "taskTitle": f"Task for {ex.jira_ticket_id}",
            "assignedTo": user_emails.get(ex.id, current_user.email),
            "timeAgo": ex.created_at.strftime("%b %d, %H:%M"),
            "commitHash": ex.commit_sha[:7] if ex.commit_sha else "pending",
            "branch": ex.branch_name,
            "model": "Claude 3.5 Sonnet",
            "phase": "Completed" if ex.status == "COMPLETED" else "Executing",
            "duration": duration_str,
            "stepsCount": len(step_breakdown),
            "status": final_status,
            "prUrl": ex.pull_request_url,
            "tokenUsage": f"{ex.token_usage} tokens" if ex.token_usage else "N/A",
            "stepBreakdown": step_breakdown,
            "files": files_list
        })
    
    
    return {
        "data": history,
        "meta": {
            "currentPage": page,
            "totalPages": math.ceil(total_records / limit) if limit > 0 else 0,
            "totalRecords": total_records,
            "hasMore": (offset + limit) < total_records
        }
    }

@router.get("/executions/metrics")
async def get_execution_metrics(
    time_filter: str = "all",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.company_id:
        return {
            "totalRunsToday": 0,
            "successRate": 0,
            "avgRuntimeSeconds": 0,
            "tokensConsumed": 0
        }
        
    now = datetime.utcnow()
    if time_filter == "7days":
        start_date = now - timedelta(days=7)
    elif time_filter == "custom":
        start_date = now - timedelta(days=30)
    elif time_filter == "today":
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = datetime.min
    
    # 1. Total runs
    total_result = await db.execute(
        select(func.count(Execution.id))
        .where(Execution.user_id == current_user.id)
        .where(Execution.created_at >= start_date)
    )
    total_runs = total_result.scalar() or 0
    
    # 2. Completed runs
    completed_result = await db.execute(
        select(func.count(Execution.id))
        .where(Execution.user_id == current_user.id)
        .where(Execution.created_at >= start_date)
        .where(Execution.status == "COMPLETED")
    )
    completed_runs = completed_result.scalar() or 0
    
    success_rate = (completed_runs / total_runs * 100) if total_runs > 0 else 0.0
    
    # 3. Average Runtime (completed_at - started_at)
    avg_runtime_result = await db.execute(
        select(Execution.started_at, Execution.completed_at)
        .where(Execution.user_id == current_user.id)
        .where(Execution.created_at >= start_date)
        .where(Execution.status == "COMPLETED")
        .where(Execution.started_at.is_not(None))
        .where(Execution.completed_at.is_not(None))
    )
    runtimes = avg_runtime_result.all()
    avg_runtime_seconds = 0.0
    if runtimes:
        total_seconds = sum((r.completed_at - r.started_at).total_seconds() for r in runtimes)
        avg_runtime_seconds = total_seconds / len(runtimes)
        
    # 4. Token Usage
    token_result = await db.execute(
        select(func.sum(Execution.token_usage))
        .where(Execution.user_id == current_user.id)
        .where(Execution.created_at >= start_date)
    )
    tokens_consumed = token_result.scalar() or 0
    
    return {
        "totalRunsToday": total_runs,
        "completedRuns": completed_runs,
        "successRate": round(success_rate, 1),
        "avgRuntimeSeconds": round(avg_runtime_seconds, 1),
        "tokensConsumed": tokens_consumed
    }

@router.websocket("/executions/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    redis_client = aioredis.Redis.from_url(settings.REDIS_URL)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("ui_updates")
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"].decode("utf-8"))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print("WebSocket Error:", e)
    finally:
        await pubsub.unsubscribe("ui_updates")
        await redis_client.aclose()

import httpx
import base64

class JiraIntegrationRequest(BaseModel):
    jira_domain: str
    jira_email: str
    jira_token: str

@router.post("/integrations/jira")
async def save_jira_integration(
    req: JiraIntegrationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.core.security import encrypt_token
    current_user.jira_domain = req.jira_domain
    current_user.jira_email = req.jira_email
    current_user.jira_token = encrypt_token(req.jira_token)
    
    await db.commit()
    return {"message": "Jira integration saved successfully"}

@router.post("/integrations/jira/disconnect")
async def disconnect_jira_integration(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    current_user.jira_domain = None
    current_user.jira_email = None
    current_user.jira_token = None
    
    await db.commit()
    return {"message": "Jira integration disconnected successfully"}

class JiraTransitionRequest(BaseModel):
    ticket_id: str
    target_status: str
    comment: str = None

@router.post("/integrations/jira/transition")
async def api_transition_jira(
    req: JiraTransitionRequest,
    current_user: User = Depends(get_current_user)
):
    await transition_jira_issue(current_user, req.ticket_id, req.target_status, req.comment)
    return {"message": "Transitioned successfully"}

@router.get("/integrations/jira/status")
async def get_jira_status(
    current_user: User = Depends(get_current_user)
):
    return {
        "connected": bool(current_user.jira_token),
        "domain": current_user.jira_domain,
        "email": current_user.jira_email
    }

class AnthropicIntegrationRequest(BaseModel):
    api_key: str

@router.get("/integrations/anthropic/status")
async def get_anthropic_status(
    current_user: User = Depends(get_current_user)
):
    if not current_user.anthropic_api_key:
        return {"connected": False, "masked_key": None}
    
    plain_token = decrypt_token(current_user.anthropic_api_key)
    if not plain_token:
        return {"connected": False, "masked_key": None}
        
    masked = plain_token[:10] + "••••••••" + plain_token[-4:] if len(plain_token) > 14 else "sk-ant-••••"
    return {
        "connected": True,
        "masked_key": masked
    }

@router.post("/integrations/anthropic")
async def save_anthropic_integration(
    req: AnthropicIntegrationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    key = req.api_key.strip()
    if not key.startswith("sk-ant-") or len(key) < 20:
        raise HTTPException(
            status_code=400, 
            detail="Invalid Anthropic API key format. Key must start with 'sk-ant-' and be a valid Anthropic credential."
        )
    
    from app.core.security import encrypt_token
    current_user.anthropic_api_key = encrypt_token(key)
    await db.commit()
    
    masked = key[:10] + "••••••••" + key[-4:] if len(key) > 14 else "sk-ant-••••"
    return {"message": "Anthropic API key connected successfully", "connected": True, "masked_key": masked}

@router.post("/integrations/anthropic/disconnect")
async def disconnect_anthropic_integration(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    current_user.anthropic_api_key = None
    await db.commit()
    return {"message": "Anthropic API key disconnected successfully", "connected": False}

async def transition_jira_issue(current_user: User, issue_key: str, target_status: str, comment: str = None):
    if not current_user.jira_domain or not current_user.jira_token:
        return
        
    auth_string = f"{current_user.jira_email}:{decrypt_token(current_user.jira_token)}"
    auth_encoded = base64.b64encode(auth_string.encode('ascii')).decode('ascii')
    domain = current_user.jira_domain.replace("https://", "").replace("http://", "")
    
    headers = {"Authorization": f"Basic {auth_encoded}", "Accept": "application/json", "Content-Type": "application/json"}
    
    async with httpx.AsyncClient() as client:
        # First, optionally add a comment
        if comment:
            comment_url = f"https://{domain}/rest/api/3/issue/{issue_key}/comment"
            comment_payload = {
                "body": {
                    "type": "doc",
                    "version": 1,
                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": comment}]}]
                }
            }
            await client.post(comment_url, json=comment_payload, headers=headers)
            
        # Get available transitions
        trans_url = f"https://{domain}/rest/api/3/issue/{issue_key}/transitions"
        resp = await client.get(trans_url, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            # Find matching transition (simple substring match with smart synonyms)
            transition_id = None
            target_lower = target_status.lower()
            candidate_names = [target_lower]
            if target_lower in ["to do", "todo", "open"]:
                candidate_names.extend(["to do", "todo", "open", "stop progress", "backlog", "reopen"])
            elif target_lower in ["in progress", "inprogress"]:
                candidate_names.extend(["in progress", "inprogress", "start progress", "start work", "in development"])
            elif target_lower in ["done", "completed", "pr ready"]:
                candidate_names.extend(["done", "completed", "resolve issue", "close issue", "ready for review", "pr ready"])

            for cand in candidate_names:
                for t in transitions:
                    name_str = t.get("name", "").lower()
                    to_str = t.get("to", {}).get("name", "").lower()
                    if cand in name_str or cand in to_str:
                        transition_id = t.get("id")
                        break
                if transition_id:
                    break
                    
            if transition_id:
                await client.post(trans_url, json={"transition": {"id": transition_id}}, headers=headers)

@router.get("/projects")
async def get_projects(
    current_user: User = Depends(get_current_user)
):
    if not current_user.jira_domain or not current_user.jira_token:
        return []
        
    auth_string = f"{current_user.jira_email}:{decrypt_token(current_user.jira_token)}"
    auth_encoded = base64.b64encode(auth_string.encode('ascii')).decode('ascii')
    domain = current_user.jira_domain.replace("https://", "").replace("http://", "")
    url = f"https://{domain}/rest/api/3/project"
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url, 
                headers={"Authorization": f"Basic {auth_encoded}", "Accept": "application/json"}
            )
            if resp.status_code != 200:
                print(f"Jira API Error: {resp.text}")
                return []
            return resp.json()
    except Exception as e:
        print(f"Error connecting to Jira: {str(e)}")
        return []

@router.get("/tickets")
async def get_tickets(
    page: int = 1,
    limit: int = 50,
    cursor: str = None,
    project_key: str = None,
    current_user: User = Depends(get_current_user)
):
    empty_res = {"data": [], "meta": {"currentPage": page, "totalPages": 0, "totalRecords": 0, "hasMore": False}}
    if not current_user.jira_domain or not current_user.jira_token:
        return empty_res
        
    auth_string = f"{current_user.jira_email}:{decrypt_token(current_user.jira_token)}"
    auth_encoded = base64.b64encode(auth_string.encode('ascii')).decode('ascii')
    domain = current_user.jira_domain.replace("https://", "").replace("http://", "")
    
    jql = "statusCategory != Done AND assignee = currentUser()"
    if project_key:
        if project_key != 'undefined' and project_key != 'null':
            jql = f"project = '{project_key}' AND " + jql
        
    url = f"https://{domain}/rest/api/3/search/jql"
    start_at = (page - 1) * limit
    
    payload = {
        "jql": jql, 
        "maxResults": limit, 
        "fields": ["summary", "description", "status", "priority", "assignee", "issuetype", "parent", "subtasks"]
    }
    if cursor:
        payload["nextPageToken"] = cursor
        
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url, 
                json=payload,
                headers={"Authorization": f"Basic {auth_encoded}", "Accept": "application/json"}
            )
            if resp.status_code != 200:
                with open('D:/codeagent-os---multi-tenant-ai-coding-infrastructure/backend/debug.log', 'a') as f:
                    f.write(f"Jira API Error {resp.status_code}: {resp.text}\n")
                print(f"Jira API Error: {resp.text}")
                return empty_res
            data = resp.json()
            
            items = data.get("issues", data.get("values", []))
            total = data.get("total", len(items))
            
            with open('D:/codeagent-os---multi-tenant-ai-coding-infrastructure/backend/debug.log', 'a') as f:
                f.write(f"Jira API Success - items: {len(items)}, total: {total}, raw: {str(data)[:200]}\n")
            
            return {
                "data": items,
                "meta": {
                    "currentPage": page,
                    "totalPages": math.ceil(total / limit) if limit > 0 else 0,
                    "totalRecords": total,
                    "hasMore": bool(data.get("nextPageToken")),
                    "nextPageToken": data.get("nextPageToken")
                }
            }
    except Exception as e:
        with open('D:/codeagent-os---multi-tenant-ai-coding-infrastructure/backend/debug.log', 'a') as f:
            f.write(f"Jira API Exception: {str(e)}\n")
        print(f"Error connecting to Jira: {str(e)}")
        return empty_res

class GithubCallback(BaseModel):
    code: str

class MergePRRequest(BaseModel):
    ticket_id: str
    pr_url: str
    target_repo: str

@router.post("/integrations/github/merge_pr")
async def merge_github_pr(
    req: MergePRRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not current_user.github_token:
        raise HTTPException(status_code=400, detail="GitHub account not connected")
        
    github_token = decrypt_token(current_user.github_token)
    
    # Parse PR number from URL
    try:
        pr_num = int(req.pr_url.split("/")[-1])
    except:
        raise HTTPException(status_code=400, detail="Invalid PR URL")
        
    url = f"https://api.github.com/repos/{req.target_repo}/pulls/{pr_num}/merge"
    
    async with httpx.AsyncClient() as client:
        resp = await client.put(
            url,
            headers={
                "Authorization": f"Bearer {github_token}",
                "Accept": "application/vnd.github.v3+json",
                "X-GitHub-Api-Version": "2022-11-28"
            }
        )
        if resp.status_code not in (200, 201):
            print(f"Merge PR Error: {resp.text}")
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
            
    # Transition Jira ticket to Done
    comment = f"✅ Pull Request successfully merged into {req.target_repo}."
    import asyncio
    asyncio.create_task(transition_jira_issue(current_user, req.ticket_id, "Done", comment))
    
    # Update Execution status in DB
    exec_result = await db.execute(
        select(Execution).where(Execution.jira_ticket_id == req.ticket_id).order_by(Execution.created_at.desc()).limit(1)
    )
    execution = exec_result.scalars().first()
    if execution:
        execution.status = "COMPLETED"
        await db.commit()
            
    return {"message": "PR merged successfully"}

@router.get("/integrations/github/auth")
async def github_auth(current_user: User = Depends(get_current_user)):
    client_id = getattr(settings, 'GITHUB_CLIENT_ID', 'mock_client_id')
    # Use stateless base64 state to avoid Redis dependency for local testing
    state = base64.urlsafe_b64encode(f"{current_user.id}||{uuid.uuid4()}".encode('utf-8')).decode('utf-8')
    redirect_uri = "http://localhost:8000/api/v1/developer/integrations/github/callback"
    return {"url": f"https://github.com/login/oauth/authorize?client_id={client_id}&redirect_uri={redirect_uri}&scope=repo%20user&state={state}"}

@router.get("/integrations/github/callback")
async def github_callback(
    code: str,
    state: str = None,
    db: AsyncSession = Depends(get_db)
):
    client_id = getattr(settings, 'GITHUB_CLIENT_ID', 'mock_client_id')
    client_secret = getattr(settings, 'GITHUB_CLIENT_SECRET', 'mock_secret')
    
    if not state:
        return RedirectResponse(url="http://localhost:3002/developer?github_connected=false&error=invalid_state")
        
    try:
        decoded_state = base64.urlsafe_b64decode(state.encode('utf-8')).decode('utf-8')
        user_id_str = decoded_state.split("||")[0]
        user_id = int(user_id_str)
    except Exception:
        return RedirectResponse(url="http://localhost:3002/developer?github_connected=false&error=invalid_state")

    user_result = await db.execute(select(User).where(User.id == user_id))
    current_user = user_result.scalars().first()
    
    if not current_user:
        return RedirectResponse(url="http://localhost:3002/developer?github_connected=false&error=user_not_found")
    
    if client_id == 'mock_client_id' or code == 'mock_code':
        # Mock flow for demo
        current_user.github_token = encrypt_token("mock_gh_token_12345")
        await db.commit()
        return RedirectResponse(url="http://localhost:3002/developer?github_connected=true")
        
    # Real flow
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={"client_id": client_id, "client_secret": client_secret, "code": code},
            headers={"Accept": "application/json"}
        )
        data = resp.json()
        if "access_token" in data:
            current_user.github_token = encrypt_token(data["access_token"])
            await db.commit()
            return RedirectResponse(url="http://localhost:3002/developer?github_connected=true")
        else:
            return RedirectResponse(url="http://localhost:3002/developer?github_connected=false&error=no_token")

@router.get("/integrations/github/status")
async def github_status(
    current_user: User = Depends(get_current_user)
):
    if not current_user.github_token:
        return {"connected": False}
        
    try:
        token = decrypt_token(current_user.github_token)
        if token == "mock_gh_token_12345":
            return {
                "connected": True,
                "username": "ksingh123456789",
                "email": "ksingh@seasiainfotech"
            }
            
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"}
            )
            data = resp.json()
            if resp.status_code == 403 and "rate limit" in data.get("message", "").lower():
                return {
                    "connected": True,
                    "username": "ksingh123456789 (Rate Limited)",
                    "email": "ksingh@seasiainfotech"
                }
            return {
                "connected": True,
                "username": data.get("login"),
                "email": data.get("email")
            }
    except Exception:
        return {"connected": False}

@router.get("/integrations/github/repos")
async def github_repos(
    current_user: User = Depends(get_current_user)
):
    if not current_user.github_token:
        return []
        
    try:
        token = decrypt_token(current_user.github_token)
        if token == "mock_gh_token_12345":
            return [
                {"full_name": "ksingh123456789/ai-knowledge-assistant", "private": False},
                {"full_name": "Seasia-Internal/employee-verification-api-setu", "private": True}
            ]
            
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"}
            )
            data = resp.json()
            if resp.status_code == 403 and "rate limit" in data.get("message", "").lower():
                # Fallback to mock data because user is rate limited
                return [
                    {"full_name": "ksingh123456789/ai-knowledge-assistant", "private": False},
                    {"full_name": "Seasia-Internal/employee-verification-api-setu", "private": True}
                ]
            return data
    except Exception:
        return []

@router.get("/integrations/github/repos/{owner}/{repo}/branches")
async def github_repo_branches(
    owner: str,
    repo: str,
    current_user: User = Depends(get_current_user)
):
    if not current_user.github_token:
        return []
    
    if decrypt_token(current_user.github_token) == "mock_gh_token_12345":
        # Return mock branches
        return [{"name": "main"}, {"name": "dev"}, {"name": "staging"}, {"name": "feature/ksingh123456789/FULLSTACK-001"}]
        
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/branches",
                headers={"Authorization": f"Bearer {decrypt_token(current_user.github_token)}", "Accept": "application/json"}
            )
            if resp.status_code != 200:
                return []
            return resp.json()
    except Exception:
        return []

@router.get("/integrations/github/repos/{owner}/{repo}/pulls/by-ticket/{ticket_key}")
async def get_github_pr_by_ticket(
    owner: str,
    repo: str,
    ticket_key: str,
    current_user: User = Depends(get_current_user)
):
    if not current_user.github_token:
        return None
        
    try:
        token = decrypt_token(current_user.github_token)
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=100",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"}
            )
            if resp.status_code == 200:
                prs = resp.json()
                for pr in prs:
                    if ticket_key.lower() in pr.get("head", {}).get("ref", "").lower() or ticket_key.lower() in pr.get("title", "").lower():
                        return pr
            return None
    except Exception:
        return None

@router.get("/integrations/github/repos/{owner}/{repo}/pulls/{pull_number}/files")
async def github_pr_files(
    owner: str,
    repo: str,
    pull_number: int,
    current_user: User = Depends(get_current_user)
):
    try:
        headers = {"Accept": "application/vnd.github.v3+json"}
        token = None
        
        if current_user.github_token:
            try:
                token = decrypt_token(current_user.github_token)
            except Exception:
                pass # Corrupted token, ignore and proceed unauthenticated
                

        if token and token != "mock_gh_token_12345":
            headers["Authorization"] = f"Bearer {token}"

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/files",
                headers=headers
            )
            if resp.status_code != 200:
                print(f"GH API ERROR {resp.status_code}: {resp.text}")
                return []
            return resp.json()
    except Exception as e:
        print(f"GH API EXCEPTION: {str(e)}")
        return []

@router.get("/integrations/github/repos/{owner}/{repo}/pulls/{pull_number}/comments")
async def github_pr_comments(
    owner: str,
    repo: str,
    pull_number: int,
    current_user: User = Depends(get_current_user)
):
    try:
        headers = {"Accept": "application/vnd.github.v3+json"}
        token = None
        if current_user.github_token:
            try:
                token = decrypt_token(current_user.github_token)
            except Exception:
                pass

        if token and token != "mock_gh_token_12345":
            headers["Authorization"] = f"Bearer {token}"

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/issues/{pull_number}/comments",
                headers=headers
            )
            if resp.status_code != 200:
                return []
            
            data = resp.json()
            comments = []
            for c in data:
                comments.append({
                    "id": str(c.get("id")),
                    "author": c.get("user", {}).get("login", "Unknown"),
                    "time": c.get("created_at"),
                    "text": c.get("body")
                })
            
            resp_review = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/comments",
                headers=headers
            )
            if resp_review.status_code == 200:
                for c in resp_review.json():
                    comments.append({
                        "id": str(c.get("id")),
                        "author": c.get("user", {}).get("login", "Unknown"),
                        "time": c.get("created_at"),
                        "text": c.get("body")
                    })
                    
            comments.sort(key=lambda x: x["time"])
            
            from datetime import datetime
            for c in comments:
                try:
                    dt = datetime.strptime(c["time"], "%Y-%m-%dT%H:%M:%SZ")
                    c["time"] = dt.strftime("%b %d, %Y %H:%M")
                except:
                    pass
            
            return comments
    except Exception as e:
        print(f"GH API EXCEPTION: {str(e)}")
        return []

import logging
logging.basicConfig(filename='D:/debug.log', level=logging.DEBUG)

