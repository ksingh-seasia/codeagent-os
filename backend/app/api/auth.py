from datetime import timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from sqlalchemy.future import select
from pydantic import BaseModel, EmailStr
from app.core.config import settings
from app.core.security import verify_password, create_access_token, validate_password
from app.db.session import get_db
from app.models.domain import User
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid credentials")
        

    try:
        user_id_int = int(user_id)
        result = await db.execute(select(User).where(User.id == user_id_int))
        user = result.scalars().first()
        if user:
            return user
    except ValueError:
        pass
        
    raise HTTPException(status_code=401, detail="User not found")



class LoginRequest(BaseModel):
    email: EmailStr
    password: str

from sqlalchemy.orm import selectinload
from app.models.domain import Company
from app.services.super_admin import get_or_create_platform_settings

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Successfully logged out. Token revoked."}

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "company_id": current_user.company_id
    }

@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()
    
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    if user.company_id:
        comp_result = await db.execute(select(Company).where(Company.id == user.company_id))
        company = comp_result.scalars().first()
        if company and company.status == "SUSPENDED":
            raise HTTPException(status_code=403, detail="Access Denied: Organization is suspended")
    
    access_token = create_access_token(subject=user.id)
    refresh_token = create_access_token(subject=user.id, expires_delta=timedelta(days=7))
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token,
        "token_type": "bearer", 
        "role": user.role,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "company_id": user.company_id
        }
    }

def send_reset_email(email_to: str, reset_token: str, role: str = None):
    # Route link to appropriate portal port
    if role == "SUPER_ADMIN":
        port = 3000
    elif role == "TENANT_ADMIN":
        port = 3001
    else:
        port = 3002
        
    reset_link = f"http://localhost:{port}/reset-password?token={reset_token}"
    
    print(f"\n========================================")
    print(f" PASSWORD RESET REQUEST")
    print(f" User Email: {email_to}")
    print(f" Reset Token: {reset_token}")
    print(f" Reset Link: {reset_link}")
    print(f"========================================\n")

    try:
        msg = MIMEMultipart()
        msg['From'] = settings.MAIL_FROM
        msg['To'] = email_to
        msg['Subject'] = "Password Reset Request"
        
        body = f"Click the following link to reset your password: {reset_link}"
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=10)
        if settings.MAIL_STARTTLS:
            server.starttls()
        if settings.USE_CREDENTIALS:
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"Reset email successfully sent to {email_to}")
    except Exception as e:
        print(f"Notice: SMTP delivery failed for {email_to} ({e}). Used server console fallback.")

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user_result = await db.execute(select(User).where(User.email == req.email))
    user = user_result.scalars().first()
    if user:
        reset_token = create_access_token(subject=str(user.id), expires_delta=timedelta(minutes=15))
        background_tasks.add_task(send_reset_email, req.email, reset_token, user.role)
    else:
        print(f"Password reset requested for unknown email: {req.email}")
    return {"message": "If the email is registered, a reset link will be sent securely."}

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(req.token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
        
    try:
        user_id_int = int(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid token payload")

    user_result = await db.execute(select(User).where(User.id == user_id_int))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    from app.core.security import get_password_hash
    user.password_hash = get_password_hash(req.new_password)
    await db.commit()
    return {"message": "Password reset successfully. You can now log in with your new password."}

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not verify_password(req.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    from app.core.security import get_password_hash
    current_user.password_hash = get_password_hash(req.new_password)
    await db.commit()
    return {"message": "Password changed successfully."}

@router.get("/github/login")
async def github_login(redirect_uri: str = Query(...), invite_token: str = None):
    if not settings.GITHUB_CLIENT_ID:
        return RedirectResponse(url=f"{redirect_uri}?error=GITHUB_CLIENT_ID not configured")
        
    backend_callback = "http://localhost:8000/api/v1/auth/github/callback"
    state = f"{redirect_uri}||{invite_token}" if invite_token else redirect_uri # Pass both via state
    github_auth_url = f"https://github.com/login/oauth/authorize?client_id={settings.GITHUB_CLIENT_ID}&redirect_uri={backend_callback}&scope=user:email%20repo&state={state}"
    return RedirectResponse(url=github_auth_url)

@router.get("/github/callback")
async def github_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    if "||" in state:
        redirect_uri, invite_token = state.split("||", 1)
    else:
        redirect_uri = state
        invite_token = None

    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        return RedirectResponse(url=f"{redirect_uri}?error=GitHub OAuth secrets not configured")

    # 1. Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": "http://localhost:8000/api/v1/auth/github/callback"
            }
        )
        token_data = token_response.json()
        
        if "error" in token_data:
            error_desc = token_data.get('error_description', 'unknown_error')
            return RedirectResponse(url=f"{redirect_uri}?error=GitHub OAuth error: {error_desc}")
            
        access_token = token_data.get("access_token")
        
        # 2. Fetch user's emails (Optional now, but good for saving primary email if needed)
        email_response = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        emails = email_response.json()
        primary_email = next((e.get("email") for e in emails if e.get("primary")), None)

    # 3. Find user in database
    user = None
    if invite_token and invite_token != "null":
        result = await db.execute(select(User).where(User.invite_token == invite_token))
        user = result.scalars().first()
        
    if not user and primary_email:
        # Fallback to strict email matching if no token provided or token was invalid/already consumed
        result = await db.execute(select(User).where(User.email == primary_email))
        user = result.scalars().first()

    if not user:
        if invite_token and invite_token != "null":
            return RedirectResponse(url=f"{redirect_uri}?error=Invalid or expired invitation token")
        elif not primary_email:
            return RedirectResponse(url=f"{redirect_uri}?error=No primary email found in GitHub account")
        else:
            return RedirectResponse(url=f"{redirect_uri}?error=No invited developer found for the GitHub email: {primary_email}")
        
    if user.status == "Invited":
        user.status = "ACTIVE"
        user.invite_token = None # Clear token after use
    
    # Store GitHub token securely
    from app.core.security import encrypt_token
    user.github_token = encrypt_token(access_token) 
    
    await db.commit()
    
    platform_token = create_access_token(subject=user.id)
    
    # Redirect back to the frontend with the JWT token
    return RedirectResponse(url=f"{redirect_uri}?token={platform_token}&role={user.role}")
