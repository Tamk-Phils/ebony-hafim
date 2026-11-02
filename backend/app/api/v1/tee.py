import secrets
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.all_models import Admin
from backend.app.schemas.schemas import TEEStatusResponse, AttestationRequest, AttestationResponse
from backend.app.services.tee_service import tee_service
from backend.app.api.deps import get_current_admin, log_audit

router = APIRouter(prefix="/tee", tags=["TEE Operations & Attestation"])

@router.get("/status", response_model=TEEStatusResponse)
def get_tee_status(
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    tee_service.sync_db_status(db)
    stat = tee_service.get_status()
    return TEEStatusResponse(
        platform=stat.platform,
        mode=stat.mode,
        is_connected=stat.is_connected,
        hardware_backed=stat.hardware_backed,
        hardware_warning=stat.hardware_warning,
        attestation_status=stat.attestation_status,
        enclave_cid=stat.enclave_cid,
        enclave_port=stat.enclave_port,
        measurements=stat.measurements,
        total_verifications=stat.total_verifications,
        total_rejections=stat.total_rejections,
        last_error=stat.last_error
    )

@router.post("/verify-connection")
def verify_tee_connection(
    request: Request,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    rec = tee_service.sync_db_status(db)
    log_audit(db, admin.username, "TEE_VERIFY_CONNECTION", "tee_engine", f"Status: {rec.deployment_mode}, Connected: {rec.is_connected}", request)
    return {
        "is_connected": rec.is_connected,
        "platform": rec.platform,
        "mode": rec.deployment_mode,
        "hardware_backed": (rec.deployment_mode == "NITRO_ENCLAVE_HARDWARE"),
        "last_error": rec.last_error
    }

@router.post("/attestation", response_model=AttestationResponse)
def verify_attestation(
    req: AttestationRequest,
    request: Request,
    admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    nonce = req.nonce or secrets.token_hex(16)
    res = tee_service.verify_attestation(nonce)
    tee_service.sync_db_status(db)
    log_audit(db, admin.username, "TEE_ATTESTATION_CHECK", "attestation_authority", f"Valid: {res.is_valid}, Satisfied: {res.trust_policy_satisfied}", request)
    return AttestationResponse(
        is_valid=res.is_valid,
        trust_policy_satisfied=res.trust_policy_satisfied,
        pcr0=res.pcr0,
        pcr1=res.pcr1,
        pcr2=res.pcr2,
        signer_ca=res.signer_ca,
        nonce=res.nonce,
        issued_at=res.issued_at,
        details=res.details
    )
