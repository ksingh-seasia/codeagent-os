import re
import base64
import hashlib
from datetime import datetime, timedelta
from jose import jwt
from cryptography.fernet import Fernet
from passlib.context import CryptContext
from fastapi import HTTPException, status
from app.core.config import settings
from app.models.domain import PlatformSettings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: str = None, expires_delta: timedelta = None, data: dict = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire}
    if data:
        to_encode.update(data)
    if subject is not None:
        to_encode["sub"] = str(subject)
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def validate_password(password: str, platform_settings: PlatformSettings):
    if platform_settings.min_password_length and len(password) < platform_settings.min_password_length:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password must be at least {platform_settings.min_password_length} characters long."
        )
    
    if platform_settings.require_special_chars:
        if not re.search(r'\d', password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must contain at least one number."
            )
        if not re.search(r'[^a-zA-Z0-9\s]', password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must contain at least one special character."
            )

def get_fernet():
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))

def encrypt_token(token: str) -> str:
    if not token:
        return token
    return get_fernet().encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token:
        return encrypted_token
    try:
        return get_fernet().decrypt(encrypted_token.encode()).decode()
    except Exception:
        return encrypted_token
