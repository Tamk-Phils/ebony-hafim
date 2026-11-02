from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from pydantic import BaseModel

class BaselineFileEntry(BaseModel):
    file_path: str
    sha256_hash: str
    size_bytes: int
    permissions: str
    mtime: Optional[float] = None

class BaselineInitResult(BaseModel):
    success: bool
    version: int
    total_files: int
    signature: str
    error: Optional[str] = None

class VerificationResult(BaseModel):
    verdict: str  # MATCH, TAMPERED, NEW, DELETED, PERMISSION_CHANGED, ERROR
    file_path: str
    expected_hash: Optional[str] = None
    observed_hash: Optional[str] = None
    expected_permissions: Optional[str] = None
    observed_permissions: Optional[str] = None
    sequence_no: int
    timestamp: str
    receipt_signature: str
    hardware_isolated: bool
    mode_label: str
    details: Optional[str] = None

class BaselineUpdateResult(BaseModel):
    success: bool
    file_path: str
    old_hash: Optional[str] = None
    new_hash: str
    version: int
    receipt_signature: Optional[str] = None
    error: Optional[str] = None

class TEEPlatformStatus(BaseModel):
    platform: str
    mode: str
    is_connected: bool
    hardware_backed: bool
    hardware_warning: Optional[str] = None
    attestation_status: str  # VERIFIED, REJECTED, UNVERIFIED, SIMULATED
    enclave_cid: Optional[int] = None
    enclave_port: Optional[int] = None
    measurements: Dict[str, str] = {}
    total_verifications: int = 0
    total_rejections: int = 0
    last_error: Optional[str] = None

class AttestationValidationResult(BaseModel):
    is_valid: bool
    trust_policy_satisfied: bool
    pcr0: Optional[str] = None
    pcr1: Optional[str] = None
    pcr2: Optional[str] = None
    signer_ca: Optional[str] = None
    nonce: str
    issued_at: Optional[str] = None
    details: str

class ITEEAdapter(ABC):
    """Abstract interface defining operations for TEE-resident comparison engines."""

    @abstractmethod
    def initialize_baseline(self, files: List[BaselineFileEntry], admin_token: str) -> BaselineInitResult:
        """Initializes the authoritative baseline inside the protected engine."""
        pass

    @abstractmethod
    def verify_file(
        self,
        file_path: str,
        observed_hash: Optional[str],
        size_bytes: int,
        permissions: str,
        sequence_no: int
    ) -> VerificationResult:
        """Verifies an observed file state against the protected baseline."""
        pass

    @abstractmethod
    def approve_baseline_update(
        self,
        file_path: str,
        new_hash: str,
        admin_token: str,
        sequence_no: int
    ) -> BaselineUpdateResult:
        """Atomically and securely updates a baseline entry under administrative authorization."""
        pass

    @abstractmethod
    def get_baseline_status(self) -> Dict[str, Any]:
        """Returns metadata about the protected baseline in the TEE."""
        pass

    @abstractmethod
    def get_platform_status(self) -> TEEPlatformStatus:
        """Returns the hardware/software status, connection health, and security warnings."""
        pass

    @abstractmethod
    def verify_attestation(self, nonce: str) -> AttestationValidationResult:
        """Validates hardware remote attestation evidence against the trust policy."""
        pass
