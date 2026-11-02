import hmac
import hashlib
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from tee.interfaces.base import (
    ITEEAdapter,
    BaselineFileEntry,
    BaselineInitResult,
    VerificationResult,
    BaselineUpdateResult,
    TEEPlatformStatus,
    AttestationValidationResult,
)
from backend.app.core.security import decode_access_token

class SoftwareDevTEEAdapter(ITEEAdapter):
    """
    Local Development Adapter (Software-Only Emulation).
    
    WARNING: This adapter runs in host userspace memory.
    It provides API contract parity, strict schema validation, anti-replay sequence
    tracking, and HMAC-signed receipts, but DOES NOT provide hardware-backed memory
    encryption or isolation against host kernel or hypervisor compromise.
    """

    def __init__(self, hmac_key: bytes = b"hafim_software_emulation_secret_key"):
        self.hmac_key = hmac_key
        self._baseline: Dict[str, Dict[str, Any]] = {}
        self._version: int = 0
        self._last_sequence_seen: int = 0
        self._total_verifications: int = 0
        self._total_rejections: int = 0
        self._last_error: Optional[str] = None
        self._platform_name = "Software Emulation (Userspace)"
        self._mode_label = "DEVELOPMENT_SOFTWARE_ONLY"
        self._warning_text = (
            "WARNING: Hardware-assisted isolation is NOT ACTIVE. "
            "Running in software-only development mode. "
            "Authoritative state resides in host memory and is vulnerable to kernel-level tampering."
        )

    def _sign_receipt(self, payload: str) -> str:
        return hmac.new(self.hmac_key, payload.encode("utf-8"), hashlib.sha256).hexdigest()

    def initialize_baseline(self, files: List[BaselineFileEntry], admin_token: str) -> BaselineInitResult:
        # Require authenticated administrator credentials
        payload = decode_access_token(admin_token)
        if not payload:
            self._total_rejections += 1
            self._last_error = "Unauthorized: Invalid or missing administrator token for baseline initialization."
            return BaselineInitResult(
                success=False,
                version=self._version,
                total_files=0,
                signature="",
                error=self._last_error
            )

        self._baseline.clear()
        self._version += 1
        for f in files:
            self._baseline[f.file_path] = {
                "sha256_hash": f.sha256_hash,
                "size_bytes": f.size_bytes,
                "permissions": f.permissions,
                "mtime": f.mtime
            }

        sig_payload = f"INIT:v{self._version}:files={len(files)}:admin={payload.get('sub')}"
        sig = self._sign_receipt(sig_payload)
        return BaselineInitResult(
            success=True,
            version=self._version,
            total_files=len(self._baseline),
            signature=sig
        )

    def verify_file(
        self,
        file_path: str,
        observed_hash: Optional[str],
        size_bytes: int,
        permissions: str,
        sequence_no: int
    ) -> VerificationResult:
        now_str = datetime.now(timezone.utc).isoformat()

        # 1. Anti-Replay Check
        if sequence_no <= self._last_sequence_seen:
            self._total_rejections += 1
            self._last_error = f"Replay detected: sequence {sequence_no} <= last seen {self._last_sequence_seen}"
            sig = self._sign_receipt(f"REPLAY:{sequence_no}:{now_str}")
            return VerificationResult(
                verdict="REPLAY_DETECTED",
                file_path=file_path,
                expected_hash=None,
                observed_hash=observed_hash,
                expected_permissions=None,
                observed_permissions=permissions,
                sequence_no=sequence_no,
                timestamp=now_str,
                receipt_signature=sig,
                hardware_isolated=False,
                mode_label=self._mode_label,
                details=self._last_error
            )

        self._last_sequence_seen = sequence_no
        self._total_verifications += 1

        # 2. Check if file is in authoritative baseline
        expected = self._baseline.get(file_path)

        # File is deleted
        if observed_hash is None:
            if expected is not None:
                verdict = "DELETED"
                exp_hash = expected["sha256_hash"]
                exp_perm = expected["permissions"]
            else:
                verdict = "UNTRACKED_DELETED"
                exp_hash = None
                exp_perm = None
        # File is new / untracked
        elif expected is None:
            verdict = "NEW"
            exp_hash = None
            exp_perm = None
        # File hash mismatch -> TAMPERED
        elif expected["sha256_hash"].lower() != observed_hash.lower():
            verdict = "TAMPERED"
            exp_hash = expected["sha256_hash"]
            exp_perm = expected["permissions"]
        # Permissions changed
        elif expected["permissions"] != permissions:
            verdict = "PERMISSION_CHANGED"
            exp_hash = expected["sha256_hash"]
            exp_perm = expected["permissions"]
        # Clean match
        else:
            verdict = "MATCH"
            exp_hash = expected["sha256_hash"]
            exp_perm = expected["permissions"]

        receipt_str = f"VERIFY:{verdict}:{file_path}:{exp_hash}:{observed_hash}:{sequence_no}:{now_str}"
        sig = self._sign_receipt(receipt_str)

        return VerificationResult(
            verdict=verdict,
            file_path=file_path,
            expected_hash=exp_hash,
            observed_hash=observed_hash,
            expected_permissions=exp_perm,
            observed_permissions=permissions,
            sequence_no=sequence_no,
            timestamp=now_str,
            receipt_signature=sig,
            hardware_isolated=False,
            mode_label=self._mode_label,
            details=f"Evaluated by {self._platform_name} in {self._mode_label}"
        )

    def approve_baseline_update(
        self,
        file_path: str,
        new_hash: str,
        admin_token: str,
        sequence_no: int
    ) -> BaselineUpdateResult:
        # Require authenticated administrator credentials
        payload = decode_access_token(admin_token)
        if not payload:
            self._total_rejections += 1
            self._last_error = "Unauthorized baseline update: Invalid or missing administrator token."
            return BaselineUpdateResult(
                success=False,
                file_path=file_path,
                new_hash=new_hash,
                version=self._version,
                error=self._last_error
            )

        # Anti-replay check
        if sequence_no <= self._last_sequence_seen:
            self._total_rejections += 1
            self._last_error = f"Replay attack detected during baseline update: seq {sequence_no} <= {self._last_sequence_seen}"
            return BaselineUpdateResult(
                success=False,
                file_path=file_path,
                new_hash=new_hash,
                version=self._version,
                error=self._last_error
            )
        self._last_sequence_seen = sequence_no

        old_entry = self._baseline.get(file_path)
        old_hash = old_entry["sha256_hash"] if old_entry else None

        # Update entry
        if old_entry:
            old_entry["sha256_hash"] = new_hash
        else:
            self._baseline[file_path] = {
                "sha256_hash": new_hash,
                "size_bytes": 0,
                "permissions": "0644",
                "mtime": time.time()
            }

        self._version += 1
        sig = self._sign_receipt(f"UPDATE:{file_path}:{old_hash}->{new_hash}:v{self._version}:admin={payload.get('sub')}")
        return BaselineUpdateResult(
            success=True,
            file_path=file_path,
            old_hash=old_hash,
            new_hash=new_hash,
            version=self._version,
            receipt_signature=sig
        )

    def get_baseline_status(self) -> Dict[str, Any]:
        return {
            "version": self._version,
            "total_files": len(self._baseline),
            "last_sequence_seen": self._last_sequence_seen,
            "mode": self._mode_label
        }

    def get_platform_status(self) -> TEEPlatformStatus:
        return TEEPlatformStatus(
            platform=self._platform_name,
            mode=self._mode_label,
            is_connected=True,
            hardware_backed=False,
            hardware_warning=self._warning_text,
            attestation_status="SIMULATED",
            enclave_cid=None,
            enclave_port=None,
            measurements={
                "PCR0": "N/A (Software Dev Mode)",
                "PCR1": "N/A (Software Dev Mode)",
                "PCR2": "N/A (Software Dev Mode)"
            },
            total_verifications=self._total_verifications,
            total_rejections=self._total_rejections,
            last_error=self._last_error
        )

    def verify_attestation(self, nonce: str) -> AttestationValidationResult:
        # Software mode explicitly reports simulated status
        return AttestationValidationResult(
            is_valid=False,
            trust_policy_satisfied=False,
            pcr0="0000000000000000000000000000000000000000000000000000000000000000",
            pcr1="0000000000000000000000000000000000000000000000000000000000000000",
            pcr2="0000000000000000000000000000000000000000000000000000000000000000",
            signer_ca="Self-Signed Software Emulation",
            nonce=nonce,
            issued_at=datetime.now(timezone.utc).isoformat(),
            details="Hardware attestation is NOT available in software development mode. Hardware isolation is not active."
        )
