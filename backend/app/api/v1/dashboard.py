from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.database.session import get_db
from backend.app.models.all_models import (
    MonitoredFile,
    IntegrityEvent,
    AgentStatusRecord,
    Baseline,
    Admin
)
from backend.app.schemas.schemas import DashboardSummaryResponse
from backend.app.services.tee_service import tee_service
from backend.app.api.deps import get_current_admin

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    total_files = db.query(MonitoredFile).count()
    matching = db.query(MonitoredFile).filter(MonitoredFile.integrity_status == "MATCH").count()
    violations = db.query(MonitoredFile).filter(MonitoredFile.integrity_status.in_(["TAMPERED", "NEW", "DELETED", "PERMISSION_CHANGED"])).count()
    
    crit_count = db.query(IntegrityEvent).filter(IntegrityEvent.severity == "CRITICAL", IntegrityEvent.status == "OPEN").count()
    high_count = db.query(IntegrityEvent).filter(IntegrityEvent.severity == "HIGH", IntegrityEvent.status == "OPEN").count()

    # Agent status
    agent = db.query(AgentStatusRecord).first()
    agent_status = agent.status if agent else "STANDBY"

    # TEE status
    tee_stat = tee_service.get_status()

    # Last scan time
    last_verified = db.query(func.max(MonitoredFile.last_verified_at)).scalar()

    # Last baseline version
    latest_baseline = db.query(Baseline).filter(Baseline.is_active == True).order_by(Baseline.version.desc()).first()
    b_version = latest_baseline.version if latest_baseline else 0

    # Recent 10 events
    recent = db.query(IntegrityEvent).order_by(IntegrityEvent.timestamp.desc()).limit(10).all()
    recent_events_data = [
        {
            "id": e.id,
            "uuid": e.event_uuid,
            "timestamp": e.timestamp.isoformat(),
            "file_path": e.file_path,
            "event_type": e.event_type,
            "severity": e.severity,
            "status": e.status,
            "tee_verdict": e.tee_verdict
        } for e in recent
    ]

    # Chart data: distribution by event type
    type_counts = db.query(IntegrityEvent.event_type, func.count(IntegrityEvent.id)).group_by(IntegrityEvent.event_type).all()
    chart_data = [{"type": t, "count": c} for t, c in type_counts]
    if not chart_data:
        chart_data = [{"type": "NO_EVENTS", "count": 0}]

    return DashboardSummaryResponse(
        total_monitored_files=total_files,
        files_matching_baseline=matching,
        files_with_violations=violations,
        critical_events_count=crit_count,
        high_events_count=high_count,
        monitoring_agent_status=agent_status,
        tee_connection_status=tee_stat.is_connected,
        tee_deployment_mode=tee_stat.mode,
        tee_hardware_backed=tee_stat.hardware_backed,
        tee_hardware_warning=tee_stat.hardware_warning,
        last_scan_time=last_verified,
        last_baseline_version=b_version,
        recent_events=recent_events_data,
        detection_activity_chart=chart_data
    )

@router.get("/health")
def get_system_health(db: Session = Depends(get_db)):
    tee_stat = tee_service.get_status()
    agent = db.query(AgentStatusRecord).first()
    
    agent_healthy = (agent and agent.status == "ACTIVE")
    overall = "HEALTHY"
    if not tee_stat.is_connected:
        overall = "CRITICAL"
    elif not tee_stat.hardware_backed or not agent_healthy:
        overall = "DEGRADED"

    return {
        "status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": {
            "tee_engine": {
                "connected": tee_stat.is_connected,
                "mode": tee_stat.mode,
                "hardware_backed": tee_stat.hardware_backed,
                "warning": tee_stat.hardware_warning
            },
            "host_agent": {
                "status": agent.status if agent else "STANDBY",
                "last_heartbeat": agent.last_heartbeat.isoformat() if agent else None
            },
            "database": {
                "status": "CONNECTED"
            }
        }
    }
