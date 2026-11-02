import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Union, Any
import jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.app.core.config import settings

security_bearer = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    """Secure PBKDF2-HMAC-SHA256 password hashing with 600,000 rounds and random salt."""
    salt = secrets.token_hex(16)
    iterations = 600000
    derived = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        iterations
    )
    return f"pbkdf2:sha256:{iterations}${salt}${derived.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies password using constant-time digest comparison."""
    try:
        parts = hashed_password.split('$')
        if len(parts) != 3:
            return False
        header, salt, original_hash = parts
        _, _, iterations = header.split(':')
        iterations = int(iterations)
        derived = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations
        )
        return secrets.compare_digest(derived.hex(), original_hash)
    except Exception:
        return False

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "exp": expire,
        "iat": now,
        "sub": str(subject),
        "iss": "hafim-auth-authority"
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            issuer="hafim-auth-authority"
        )
        return payload
    except jwt.PyJWTError:
        return None

def compute_sha256_stream(file_path: str, chunk_size: int = 65536) -> str:
    """Stream-compute SHA-256 for a file to prevent memory exhaustion."""
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
    return hasher.hexdigest()
