# Multi-Tenant BYOK Architecture Specification: Anthropic Claude Integration

## 1. Executive Summary

This document specifies the end-to-end architecture and implementation blueprint for integrating **Anthropic Claude API Keys** into CodeAgent OS under a **Bring Your Own Key (BYOK)** model.

Previously, running autonomous agents required manual machine-level configuration on the host OS:
```powershell
[Environment]::SetEnvironmentVariable(
    "ANTHROPIC_API_KEY",
    "sk-ant-usr-...",
    "User"
)
```

This manual approach had several critical flaws:
* **Security Risk:** Sensitive API keys were exposed in plaintext machine environment variables.
* **Lack of Multi-Tenancy:** All developers and tenants shared whatever single key was set on the host.
* **Poor Developer Experience:** Developers had to exit the web portal, open PowerShell, and restart services.
* **No Quota/Billing Isolation:** A tenant could not track or limit usage to their own team accounts.

The BYOK architecture moves credential management directly into the **Developer Portal**, stores encrypted credentials at rest, dynamically routes keys per job, and locks the execution UI until valid credentials are provided.

---

## 2. High-Level Architecture & Interaction Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Tenant Admin / Org Owner
    actor Dev as Developer
    participant CC as Anthropic Claude Console
    participant Portal as Developer Portal (React)
    participant API as FastAPI Backend
    participant DB as PostgreSQL (langgraph_db)
    participant Redis as Redis Queue (agent_jobs)
    participant Worker as LangGraph Python Worker

    rect rgb(240, 244, 255)
    Note over Admin,CC: Phase 1: Organization & Key Provisioning
    Admin->>CC: Create Organization / Workspace
    Admin->>CC: Invite Developer as Member with specific spend limits
    Dev->>CC: Accept invitation & generate Developer API Key (sk-ant-...)
    end

    rect rgb(245, 250, 245)
    Note over Dev,DB: Phase 2: Credential Onboarding & Encryption
    Dev->>Portal: Navigate to Integrations -> AI Provider Settings
    Dev->>Portal: Paste Anthropic API Key & Click "Connect Anthropic"
    Portal->>API: POST /api/v1/developer/integrations/anthropic { api_key }
    API->>API: Validate format (starts with 'sk-ant-')
    API->>API: Encrypt key via Fernet (encrypt_token)
    API->>DB: UPDATE users SET anthropic_api_key = <encrypted_blob>
    API-->>Portal: HTTP 200 { status: "Connected", masked_key: "sk-ant-...DwAA" }
    Portal->>Portal: Set isAnthropicConnected = true; Unlock "Execute with AI"
    end

    rect rgb(255, 248, 240)
    Note over Dev,Worker: Phase 3: Autonomous Job Execution
    Dev->>Portal: Clicks "Execute with AI" on Jira Ticket (e.g., SCRUM-7)
    Portal->>API: POST /api/v1/developer/executions
    API->>DB: Fetch current_user; Check current_user.anthropic_api_key
    alt Key Missing
        API-->>Portal: HTTP 400 "Anthropic API key required. Connect in Integrations."
    else Key Present
        API->>API: Decrypt key using decrypt_token()
        API->>Redis: LPUSH agent_jobs { ticket_id, requirement, github_token, anthropic_api_key, ... }
        API-->>Portal: HTTP 200 { status: "Job queued successfully" }
    end
    Redis->>Worker: BRPOP agent_jobs
    Worker->>Worker: os.environ["ANTHROPIC_API_KEY"] = job_data["anthropic_api_key"]
    Worker->>CC: Call Claude 3.5 Sonnet (using developer's authenticated credentials)
    Worker-->>Portal: Stream real-time reasoning and steps over WebSocket
    end
```

---

## 3. Detailed Component Breakdown

### 3.1 Organization & Team Setup (Anthropic Console)
1. **Tenant Admin Role:**
   * Navigates to [console.anthropic.com](https://console.anthropic.com).
   * Creates an Organization (e.g. `TechCorp-Engineering`).
   * Configures billing, prepaid credits, and monthly hard/soft limits.
   * Invites developers by email under **Members / Settings**.
2. **Developer Role:**
   * Logs into Claude Console under the organization workspace.
   * Navigates to **API Keys** $\rightarrow$ **Create Key**.
   * Names the key (e.g. `codeagent-dev-token`) and copies the secret string:
     `sk-ant-api03-...` or `sk-ant-usr-...`.

---

### 3.2 Database Schema Specification

In the PostgreSQL `users` table:

```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS anthropic_api_key VARCHAR(512) NULL;
```

* **Storage Format:** Symmetrically encrypted using AES-128-CBC via Fernet (`app.core.security.encrypt_token`).
* **Security:** Plaintext keys are never persisted in databases, logs, or backups.

---

### 3.3 Backend API Specification

#### Endpoint 1: Retrieve Connection Status
* **Route:** `GET /api/v1/developer/integrations/anthropic/status`
* **Auth:** Bearer Token (Developer)
* **Response:**
```json
{
  "connected": true,
  "masked_key": "sk-ant-1qkG...DwAA"
}
```

#### Endpoint 2: Connect / Update Anthropic Key
* **Route:** `POST /api/v1/developer/integrations/anthropic`
* **Auth:** Bearer Token (Developer)
* **Payload:**
```json
{
  "api_key": "sk-ant-usr-1qkGK79gKCi6xz0GrX0HEySWHVcWwvSjHlnDYgkI8AbjJ766UtQCXV7cgJh0zLQVGJgaWheDwAA"
}
```
* **Validation:**
  1. Key must be a non-empty string starting with `sk-ant-`.
  2. Length must exceed 30 characters.
* **Storage:** `current_user.anthropic_api_key = encrypt_token(req.api_key)`.

#### Endpoint 3: Disconnect Key
* **Route:** `POST /api/v1/developer/integrations/anthropic/disconnect`
* **Auth:** Bearer Token (Developer)
* **Logic:** Sets `current_user.anthropic_api_key = None` and commits.

#### Endpoint 4: Execution Guard in `/executions`
* **Route:** `POST /api/v1/developer/executions`
* **Pre-flight Check:**
```python
if not current_user.anthropic_api_key:
    raise HTTPException(
        status_code=400,
        detail="Anthropic API key not configured. Please connect your API key in Integrations before executing with AI."
    )
```
* **Queue Payload:**
```json
{
  "execution_id": 104,
  "ticket_id": "SCRUM-7",
  "requirement": "Task: Create Login page...",
  "github_token": "ghp_...",
  "anthropic_api_key": "sk-ant-usr-...",
  "tenant_id": 1
}
```

---

### 3.4 Python Worker Dynamic Runtime Injection

In `adapters/api_adapter/worker.py`:

```python
async def process_job(raw_data, graph, redis_client):
    job_data = json.loads(raw_data)
    
    # 1. Dynamically configure Anthropic credentials for this job execution
    anthropic_key = job_data.get("anthropic_api_key")
    if anthropic_key:
        os.environ["ANTHROPIC_API_KEY"] = anthropic_key
        print(f"[{job_data.get('ticket_id')}] Loaded authenticated Anthropic API key.")
    else:
        raise ValueError("Missing Anthropic API key in job payload.")
```

And in `core/_llm.py`:
When `anthropic.Anthropic()` is initialized, it reads `os.environ["ANTHROPIC_API_KEY"]`, ensuring that all LLM calls (Analyze, Generate, TestGen, Review) are authenticated under that specific developer's quota.

---

### 3.5 Developer Portal UI & UX Specification

#### A. Integrations Page (`DeveloperIntegrations.tsx`)
A dedicated **AI Provider Settings** card:
* **Header:** Anthropic Claude brand avatar + title + connected status pill (`Connected` in green or `Not connected` in gray).
* **If Connected:**
  * Shows masked key: `sk-ant-1qkG...DwAA`
  * Action buttons: `Update Key` and `Disconnect`
  * Subtitle: `Credentials are stored securely by the backend.`
* **If Not Connected:**
  * Password-masked input field: `Paste your Anthropic API key (sk-ant-...)`
  * `Connect Anthropic` action button with loading spinner
  * Helpful link: `Get an API key from Anthropic Console ->`

#### B. Developer Workbench Guard (`DeveloperWorkbench.tsx`)
1. **Workbench Top Alert Banner:**
   If `!isAnthropicConnected`:
   > ⚠️ **AI Agent Disabled:** Anthropic API key is not connected. [Configure in Integrations $\rightarrow$]
2. **Execute Button States:**
   * **When Connected:** Blue button `[ auto_mode Execute with AI ]` is fully clickable.
   * **When Not Connected:**
     * Button displays in a locked/disabled styling: `[ vpn_key_off Connect Key to Execute ]`
     * Hover tooltip: *"Connect your Anthropic API Key in Integrations to enable AI execution."*
     * Clicking the locked button automatically redirects the developer to the Integrations page with a helpful toast notification.

---

## 4. Error Handling & Edge Cases

| Failure Scenario | System Behavior | Developer Guidance |
|---|---|---|
| **Invalid Key Format** | Rejected at API (`HTTP 400`) during `POST /integrations/anthropic` | In-app toast: *"Invalid key format. Keys start with sk-ant-"* |
| **Revoked / Inactive Key** | Anthropic API returns `HTTP 401 Unauthorized` during worker analysis | Worker sends `error` WebSocket event; ticket reset to `To Do`; toast: *"Anthropic API Key unauthorized or expired."* |
| **Quota / Credit Exhausted** | Anthropic API returns `HTTP 429 / credit_limit_exceeded` | Ticket moved back to `To Do`; log shows clear message: *"Anthropic quota exceeded. Please check Claude Console billing."* |
| **Worker Restarts Mid-Job** | State recovered from PostgreSQL LangGraph checkpoint; job resumed with payload key | Seamless continuation; no credential loss |

---

## 5. Security & Compliance Safeguards

1. **Zero Plaintext Persistence:** Keys are encrypted immediately upon receipt using Fernet encryption (`cryptography` library) before hitting PostgreSQL.
2. **Key Masking:** The frontend only ever receives masked prefixes and suffixes (e.g. `sk-ant-1qkG...DwAA`). The full key is never transmitted back to the browser.
3. **No Terminal / Log Leakage:** System logs only log masked identifiers (`sk-ant-***`).
4. **Tenant Isolation:** In multi-tenant environments, keys are scoped strictly to individual user IDs or company IDs, preventing cross-tenant token contamination.
