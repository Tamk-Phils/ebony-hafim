from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.all_models import MonitoredFile, MonitoringTarget, Admin
from backend.app.schemas.schemas import (
    MonitoredFileResponse,
    AddTargetRequest,
    TargetResponse
)
from backend.app.services.fim_service import fim_service
from backend.app.api.deps import get_current_admin, log_audit

router = APIRouter(prefix="/monitored-files", tags=["Monitored Files"])

@router.get("", response_model=List[MonitoredFileResponse])
def get_monitored_files(
    search: Optional[str] = None,
    integrity_status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(MonitoredFile)
    if search:
        query = query.filter(MonitoredFile.file_path.ilike(f"%{search}%"))
    if integrity_status:
        query = query.filter(MonitoredFile.integrity_status == integrity_status.upper())
    return query.order_by(MonitoredFile.file_path.asc()).offset(offset).limit(limit).all()

@router.get("/targets", response_model=List[TargetResponse])
def get_targets(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return db.query(MonitoringTarget).order_by(MonitoringTarget.created_at.desc()).all()

@router.post("/targets", response_model=TargetResponse)
def add_target(
    req: AddTargetRequest,
    request: Request,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    try:
        target = fim_service.add_monitoring_target(
            db=db,
            path=req.path,
            is_recursive=req.is_recursive,
            description=req.description
        )
        log_audit(db, admin.username, "ADD_TARGET", target.path, f"Added monitoring target: {req.path}", request)
        return target
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.delete("/targets/{target_id}")
def delete_target(
    target_id: int,
    request: Request,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    target = db.query(MonitoringTarget).filter(MonitoringTarget.id == target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    path = target.path
    fim_service.remove_monitoring_target(db, target_id)
    log_audit(db, admin.username, "DELETE_TARGET", path, f"Removed monitoring target id: {target_id}", request)
    return {"message": f"Target '{path}' removed successfully."}

@router.get("/{file_id}", response_model=MonitoredFileResponse)
def get_file_detail(
    file_id: int,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    f = db.query(MonitoredFile).filter(MonitoredFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Monitored file record not found.")
    return f

@router.post("/{file_id}/verify")
def verify_single_file(
    file_id: int,
    request: Request,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    f = db.query(MonitoredFile).filter(MonitoredFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Monitored file record not found.")

    res = fim_service.verify_file_against_tee(db, f.file_path)
    log_audit(db, admin.username, "VERIFY_FILE", f.file_path, f"Verdict: {res.verdict}", request)
    return {
        "file_id": f.id,
        "file_path": f.file_path,
        "verdict": res.verdict,
        "expected_hash": res.expected_hash,
        "observed_hash": res.observed_hash,
        "receipt_signature": res.receipt_signature,
        "sequence_no": res.sequence_no,
        "hardware_isolated": res.hardware_isolated,
        "mode_label": res.mode_label
    }

@router.post("/scan")
def trigger_full_scan(
    request: Request,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    results = fim_service.trigger_full_scan(db)
    log_audit(db, admin.username, "FULL_SCAN", "all_targets", f"Scanned: {results['total']}, Violations: {results['violations']}", request)
    return results
