import io
import csv
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.all_models import IntegrityEvent, Admin
from backend.app.schemas.schemas import IntegrityEventResponse, EventStatusUpdateRequest
from backend.app.api.deps import get_current_admin, log_audit

router = APIRouter(prefix="/events", tags=["Integrity Events"])

@router.get("", response_model=List[IntegrityEventResponse])
def get_events(
    search: Optional[str] = None,
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    query = db.query(IntegrityEvent)
    if search:
        query = query.filter(IntegrityEvent.file_path.ilike(f"%{search}%"))
    if severity:
        query = query.filter(IntegrityEvent.severity == severity.upper())
    if event_type:
        query = query.filter(IntegrityEvent.event_type == event_type.upper())
    if status:
        query = query.filter(IntegrityEvent.status == status.upper())

    return query.order_by(IntegrityEvent.timestamp.desc()).offset(offset).limit(limit).all()

@router.get("/export")
def export_events_csv(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    events = db.query(IntegrityEvent).order_by(IntegrityEvent.timestamp.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Event ID", "UUID", "Timestamp", "File Path", "Event Type",
        "Severity", "Status", "Expected Hash", "Observed Hash",
        "Expected Perms", "Observed Perms", "TEE Verdict", "Receipt Sig", "Sequence", "Source Agent"
    ])
    for e in events:
        writer.writerow([
            e.id, e.event_uuid, e.timestamp.isoformat(), e.file_path, e.event_type,
            e.severity, e.status, e.expected_hash, e.observed_hash,
            e.expected_permissions, e.observed_permissions, e.tee_verdict,
            e.tee_receipt_sig, e.tee_sequence, e.source_agent
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=hafim_integrity_events.csv"}
    )

@router.get("/{event_id}", response_model=IntegrityEventResponse)
def get_event(
    event_id: int,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    event = db.query(IntegrityEvent).filter(IntegrityEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Integrity event not found.")
    return event

@router.patch("/{event_id}/status", response_model=IntegrityEventResponse)
def update_event_status(
    event_id: int,
    req: EventStatusUpdateRequest,
    request: Request,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    event = db.query(IntegrityEvent).filter(IntegrityEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Integrity event not found.")

    old_status = event.status
    event.status = req.status.upper()
    db.commit()
    db.refresh(event)

    log_audit(db, admin.username, "UPDATE_EVENT_STATUS", f"event_{event.id}", f"Status changed from {old_status} to {event.status}", request)
    return event
