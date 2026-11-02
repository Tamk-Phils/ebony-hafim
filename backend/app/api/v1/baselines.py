from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.all_models import (
    Baseline,
    BaselineEntry,
    BaselineChangeApproval,
    Admin
)
from backend.app.schemas.schemas import (
    BaselineResponse,
    BaselineEntryResponse,
    BaselineInitRequest,
    BaselineApprovalRequest,
    BaselineApprovalResponse
)
from backend.app.services.fim_service import fim_service
from backend.app.api.deps import get_current_admin, get_admin_and_token, log_audit

router = APIRouter(prefix="/baselines", tags=["Baselines"])

@router.get("", response_model=List[BaselineResponse])
def get_baselines(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return db.query(Baseline).order_by(Baseline.version.desc()).all()

@router.get("/{baseline_id}/entries", response_model=List[BaselineEntryResponse])
def get_baseline_entries(
    baseline_id: int,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    b = db.query(Baseline).filter(Baseline.id == baseline_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Baseline not found.")
    return db.query(BaselineEntry).filter(BaselineEntry.baseline_id == baseline_id).all()

@router.post("/initialize")
def initialize_baseline(
    req: BaselineInitRequest,
    request: Request,
    auth_data = Depends(get_admin_and_token),
    db: Session = Depends(get_db)
):
    admin, token = auth_data
    success, msg, version = fim_service.initialize_baseline(
        db=db,
        admin_username=admin.username,
        admin_token=token,
        notes=req.notes
    )
    if not success:
        log_audit(db, admin.username, "BASELINE_INIT_FAILED", "tee_baseline", msg, request)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    log_audit(db, admin.username, "BASELINE_INITIALIZED", f"baseline_v{version}", f"Notes: {req.notes}", request)
    return {"message": msg, "version": version}

@router.post("/approve-update")
def approve_baseline_update(
    req: BaselineApprovalRequest,
    request: Request,
    auth_data = Depends(get_admin_and_token),
    db: Session = Depends(get_db)
):
    admin, token = auth_data
    success, msg = fim_service.approve_baseline_update(
        db=db,
        file_path=req.file_path,
        new_hash=req.new_hash,
        admin_username=admin.username,
        admin_token=token,
        reason=req.reason
    )
    if not success:
        log_audit(db, admin.username, "BASELINE_UPDATE_REJECTED", req.file_path, msg, request)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    log_audit(db, admin.username, "BASELINE_UPDATE_APPROVED", req.file_path, f"New hash: {req.new_hash}", request)
    return {"message": msg, "file_path": req.file_path, "new_hash": req.new_hash}

@router.get("/approvals/history", response_model=List[BaselineApprovalResponse])
def get_approval_history(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return db.query(BaselineChangeApproval).order_by(BaselineChangeApproval.requested_at.desc()).all()
