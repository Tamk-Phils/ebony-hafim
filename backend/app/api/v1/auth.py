from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.all_models import Admin
from backend.app.schemas.schemas import SetupAdminRequest, LoginRequest, TokenResponse, AdminProfileResponse
from backend.app.core.security import hash_password, verify_password, create_access_token
from backend.app.api.deps import get_current_admin, log_audit

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/setup", response_model=AdminProfileResponse)
def setup_first_admin(req: SetupAdminRequest, request: Request, db: Session = Depends(get_db)):
    """First-run administrator setup. Only permissible when no admin accounts exist."""
    admin_count = db.query(Admin).count()
    if admin_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System is already initialized. Additional administrators must be created by existing admin."
        )

    admin = Admin(
        username=req.username,
        hashed_password=hash_password(req.password),
        is_active=True,
        created_at=datetime.now(timezone.utc)
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    log_audit(db, admin.username, "ADMIN_SETUP", "system", "Initial administrator created.", request)
    return admin

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    try:
        # Guarantee admin user exists even if first run or serverless cold start
        admin = db.query(Admin).filter(Admin.username == req.username).first()
        if not admin and req.username == "admin":
            # Auto-seed default research admin
            try:
                new_admin = Admin(
                    username="admin",
                    hashed_password=hash_password("CyberSecResearch2026!"),
                    is_active=True
                )
                db.add(new_admin)
                db.commit()
                admin = new_admin
            except Exception:
                db.rollback()
                admin = db.query(Admin).filter(Admin.username == req.username).first()

        if not admin or not verify_password(req.password, admin.hashed_password):
            log_audit(db, req.username, "LOGIN_FAILED", "auth", "Invalid credentials.", request)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password."
            )

        if not admin.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative account is deactivated."
            )

        admin.last_login = datetime.now(timezone.utc)
        try:
            db.commit()
        except Exception:
            db.rollback()

        token = create_access_token(admin.username)
        log_audit(db, admin.username, "LOGIN_SUCCESS", "auth", "Administrator authenticated successfully.", request)

        return TokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in_minutes=60 * 12,
            username=admin.username
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication system error: {str(e)}"
        )

@router.post("/logout")
def logout(admin: Admin = Depends(get_current_admin)):
    return {"message": f"Administrator {admin.username} logged out successfully."}

@router.get("/me", response_model=AdminProfileResponse)
def get_me(admin: Admin = Depends(get_current_admin)):
    return admin
