import logging
from typing import Optional
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.models.all_models import TEEStatusRecord
from tee.interfaces.base import ITEEAdapter, TEEPlatformStatus, AttestationValidationResult
from tee.adapters.software_dev_adapter import SoftwareDevTEEAdapter
from tee.adapters.nitro_enclave_adapter import NitroEnclaveTEEAdapter, HardwareUnavailableError

logger = logging.getLogger("hafim.tee")

class TEEServiceManager:
    """Manages the active TEE adapter and database status persistence."""

    def __init__(self):
        self._adapter: Optional[ITEEAdapter] = None
        self._init_adapter()

    def _init_adapter(self):
        mode = settings.TEE_MODE.upper()
        if mode == "NITRO_ENCLAVE_HARDWARE":
            logger.info("Initializing Hardware-Backed AWS Nitro Enclave Adapter...")
            self._adapter = NitroEnclaveTEEAdapter(
                cid=settings.NITRO_VSOCK_CID,
                port=settings.NITRO_VSOCK_PORT
            )
        elif mode == "DEVELOPMENT_SOFTWARE_ONLY":
            logger.info("Initializing Software-Only Development TEE Adapter...")
            self._adapter = SoftwareDevTEEAdapter()
        else:
            logger.warning(f"Unrecognized TEE_MODE '{mode}'. Defaulting to Development Software Adapter.")
            self._adapter = SoftwareDevTEEAdapter()

    @property
    def adapter(self) -> ITEEAdapter:
        if self._adapter is None:
            self._init_adapter()
        return self._adapter

    def get_status(self) -> TEEPlatformStatus:
        return self.adapter.get_platform_status()

    def verify_attestation(self, nonce: str) -> AttestationValidationResult:
        return self.adapter.verify_attestation(nonce)

    def sync_db_status(self, db: Session) -> TEEStatusRecord:
        status = self.get_status()
        record = db.query(TEEStatusRecord).first()
        if not record:
            record = TEEStatusRecord(
                platform=status.platform,
                deployment_mode=status.mode,
                is_connected=status.is_connected,
                last_attestation_status=status.attestation_status,
                pcr0=status.measurements.get("PCR0"),
                pcr1=status.measurements.get("PCR1"),
                pcr2=status.measurements.get("PCR2"),
                enclave_cid=status.enclave_cid,
                enclave_port=status.enclave_port,
                total_verifications=status.total_verifications,
                total_rejections=status.total_rejections,
                last_error=status.last_error
            )
            db.add(record)
        else:
            record.platform = status.platform
            record.deployment_mode = status.mode
            record.is_connected = status.is_connected
            record.last_attestation_status = status.attestation_status
            record.pcr0 = status.measurements.get("PCR0")
            record.pcr1 = status.measurements.get("PCR1")
            record.pcr2 = status.measurements.get("PCR2")
            record.enclave_cid = status.enclave_cid
            record.enclave_port = status.enclave_port
            record.total_verifications = status.total_verifications
            record.total_rejections = status.total_rejections
            record.last_error = status.last_error
        db.commit()
        db.refresh(record)
        return record

tee_service = TEEServiceManager()
