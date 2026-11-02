from typing import Generator, Optional, Tuple
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.core.security import decode_access_token
from backend.app.models.all_models import Admin, AuditLog

security_scheme = HTTPBearer(auto_error=False)

def get_current_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> Admin:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing Bearer token in Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    username = payload.get("sub")
    admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin account is inactive or not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return admin

def get_admin_and_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
) -> Tuple[Admin, str]:
    admin = get_current_admin(credentials, db)
    return admin, credentials.credentials

def log_audit(db: Session, admin_username: str, action: str, resource: str, details: str = None, request: Request = None):
    ip = request.client.host if request and request.client else "127.0.0.1"
    audit = AuditLog(
        admin_username=admin_username,
        action=action,
        resource=resource,
        details=details,
        ip_address=ip
    )
    db.add(audit)
    db.commit()
