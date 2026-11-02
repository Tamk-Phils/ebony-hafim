import os
import uuid
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.core.security import compute_sha256_stream
from backend.app.models.all_models import (
    MonitoringTarget,
    MonitoredFile,
    Baseline,
    BaselineEntry,
    BaselineChangeApproval,
    IntegrityEvent,
    AgentStatusRecord
)
from backend.app.services.tee_service import tee_service
from backend.app.services.websocket_manager import ws_manager
from tee.interfaces.base import BaselineFileEntry, VerificationResult

class FIMService:
    def __init__(self):
        self._sequence_counter = 0

    def get_next_sequence(self) -> int:
        self._sequence_counter += 1
        return self._sequence_counter

    def validate_path_in_approved_roots(self, target_path: str) -> str:
        resolved = str(Path(target_path).resolve())
        if settings.APPROVED_ROOTS:
            is_valid = any(
                resolved == app or resolved.startswith(app + os.sep)
                for app in settings.APPROVED_ROOTS
            )
            if not is_valid:
                raise ValueError(
                    f"Directory '{target_path}' is not within administrator approved roots: {settings.APPROVED_ROOTS}"
                )
        return resolved

    def add_monitoring_target(self, db: Session, path: str, is_recursive: bool = True, description: str = None) -> MonitoringTarget:
        validated_path = self.validate_path_in_approved_roots(path)
        existing = db.query(MonitoringTarget).filter(MonitoringTarget.path == validated_path).first()
        if existing:
            existing.is_active = True
            existing.is_recursive = is_recursive
            existing.description = description
            db.commit()
            db.refresh(existing)
            return existing

        target = MonitoringTarget(
            path=validated_path,
            is_recursive=is_recursive,
            is_active=True,
            description=description
        )
        db.add(target)
        db.commit()
        db.refresh(target)
        return target

    def remove_monitoring_target(self, db: Session, target_id: int) -> bool:
        target = db.query(MonitoringTarget).filter(MonitoringTarget.id == target_id).first()
        if not target:
            return False
        db.delete(target)
        db.commit()
        return True

    def initialize_baseline(self, db: Session, admin_username: str, admin_token: str, notes: str = None) -> Tuple[bool, str, int]:
        targets = db.query(MonitoringTarget).filter(MonitoringTarget.is_active == True).all()
        if not targets:
            return False, "No active monitoring targets configured to initialize baseline.", 0

        entries_to_init: List[BaselineFileEntry] = []
        file_meta_list = []

        for target in targets:
            root = target.path
            if not os.path.exists(root):
                continue

            if os.path.isfile(root):
                try:
                    h = compute_sha256_stream(root)
                    st = os.stat(root)
                    perms = oct(st.st_mode & 0o777)[2:].zfill(4)
                    entry = BaselineFileEntry(
                        file_path=root,
                        sha256_hash=h,
                        size_bytes=st.st_size,
                        permissions=perms,
                        mtime=st.st_mtime
                    )
                    entries_to_init.append(entry)
                    file_meta_list.append((target.id, root, h, st.st_size, perms, "regular"))
                except Exception:
                    pass
            elif os.path.isdir(root):
                walk_iter = os.walk(root) if target.is_recursive else [(root, [], os.listdir(root))]
                for dirpath, _, filenames in walk_iter:
                    for fname in filenames:
                        fpath = os.path.join(dirpath, fname)
                        if os.path.isfile(fpath) and not os.path.islink(fpath):
                            try:
                                h = compute_sha256_stream(fpath)
                                st = os.stat(fpath)
                                perms = oct(st.st_mode & 0o777)[2:].zfill(4)
                                entry = BaselineFileEntry(
                                    file_path=fpath,
                                    sha256_hash=h,
                                    size_bytes=st.st_size,
                                    permissions=perms,
                                    mtime=st.st_mtime
                                )
                                entries_to_init.append(entry)
                                file_meta_list.append((target.id, fpath, h, st.st_size, perms, "regular"))
                            except Exception:
                                pass

        if not entries_to_init:
            return False, "No regular files found within active monitoring targets.", 0

        # Call TEE Comparison Engine to securely store authoritative baseline
        init_res = tee_service.adapter.initialize_baseline(entries_to_init, admin_token)
        if not init_res.success:
            return False, f"TEE Baseline Initialization Rejected: {init_res.error}", 0

        # Deactivate older baselines
        db.query(Baseline).update({Baseline.is_active: False})

        # Persist new baseline record in database
        new_baseline = Baseline(
            version=init_res.version,
            created_by=admin_username,
            is_active=True,
            notes=notes or f"Baseline initialized by {admin_username}",
            total_files=len(entries_to_init),
            enclave_signature=init_res.signature
        )
        db.add(new_baseline)
        db.flush()

        for (target_id, fpath, h, size, perms, ftype) in file_meta_list:
            b_entry = BaselineEntry(
                baseline_id=new_baseline.id,
                file_path=fpath,
                sha256_hash=h,
                size_bytes=size,
                permissions=perms
            )
            db.add(b_entry)

            # Update or create MonitoredFile record
            mon_file = db.query(MonitoredFile).filter(MonitoredFile.file_path == fpath).first()
            if not mon_file:
                mon_file = MonitoredFile(
                    target_id=target_id,
                    file_path=fpath,
                    file_type=ftype,
                    size_bytes=size,
                    permissions=perms,
                    expected_hash=h,
                    last_observed_hash=h,
                    integrity_status="MATCH",
                    last_verified_at=datetime.now(timezone.utc),
                    baseline_version=init_res.version
                )
                db.add(mon_file)
            else:
                mon_file.target_id = target_id
                mon_file.expected_hash = h
                mon_file.last_observed_hash = h
                mon_file.size_bytes = size
                mon_file.permissions = perms
                mon_file.integrity_status = "MATCH"
                mon_file.last_verified_at = datetime.now(timezone.utc)
                mon_file.baseline_version = init_res.version

        db.commit()
        return True, "Baseline initialized successfully in TEE and database.", new_baseline.version

    def verify_file_against_tee(
        self,
        db: Session,
        file_path: str,
        observed_hash: Optional[str] = None,
        size_bytes: int = 0,
        permissions: str = "0644"
    ) -> VerificationResult:
        if observed_hash is None and os.path.exists(file_path):
            observed_hash = compute_sha256_stream(file_path)
            st = os.stat(file_path)
            size_bytes = st.st_size
            permissions = oct(st.st_mode & 0o777)[2:].zfill(4)

        seq = self.get_next_sequence()
        result = tee_service.adapter.verify_file(
            file_path=file_path,
            observed_hash=observed_hash,
            size_bytes=size_bytes,
            permissions=permissions,
            sequence_no=seq
        )

        # Update MonitoredFile status
        mon_file = db.query(MonitoredFile).filter(MonitoredFile.file_path == file_path).first()
        if mon_file:
            mon_file.last_observed_hash = observed_hash
            mon_file.permissions = permissions
            mon_file.size_bytes = size_bytes
            mon_file.last_verified_at = datetime.now(timezone.utc)

            if result.verdict == "MATCH":
                mon_file.integrity_status = "MATCH"
            elif result.verdict == "TAMPERED":
                mon_file.integrity_status = "TAMPERED"
            elif result.verdict == "DELETED":
                mon_file.integrity_status = "DELETED"
            elif result.verdict == "PERMISSION_CHANGED":
                mon_file.integrity_status = "PERMISSION_CHANGED"
            elif result.verdict == "NEW":
                mon_file.integrity_status = "NEW"
            else:
                mon_file.integrity_status = "UNVERIFIED"

        # Record Integrity Event if there is an anomaly
        if result.verdict in ("TAMPERED", "NEW", "DELETED", "PERMISSION_CHANGED", "REPLAY_DETECTED", "HARDWARE_UNAVAILABLE"):
            severity_map = {
                "TAMPERED": "CRITICAL",
                "REPLAY_DETECTED": "CRITICAL",
                "HARDWARE_UNAVAILABLE": "CRITICAL",
                "DELETED": "HIGH",
                "PERMISSION_CHANGED": "HIGH",
                "NEW": "MEDIUM"
            }
            event_type_map = {
                "TAMPERED": "MODIFICATION",
                "DELETED": "DELETION",
                "PERMISSION_CHANGED": "PERMISSION_CHANGE",
                "NEW": "CREATION",
                "REPLAY_DETECTED": "REPLAY_ATTACK",
                "HARDWARE_UNAVAILABLE": "TEE_ERROR"
            }

            event = IntegrityEvent(
                event_uuid=str(uuid.uuid4()),
                file_path=file_path,
                event_type=event_type_map.get(result.verdict, "BASELINE_VIOLATION"),
                expected_hash=result.expected_hash,
                observed_hash=observed_hash,
                expected_permissions=result.expected_permissions,
                observed_permissions=permissions,
                severity=severity_map.get(result.verdict, "HIGH"),
                status="OPEN",
                tee_verdict=result.verdict,
                tee_receipt_sig=result.receipt_signature,
                tee_sequence=result.sequence_no,
                source_agent="host-agent-01",
                details=result.details
            )
            db.add(event)
            db.commit()

            # Schedule asynchronous broadcast
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(ws_manager.broadcast_event({
                        "id": event.id,
                        "uuid": event.event_uuid,
                        "file_path": event.file_path,
                        "event_type": event.event_type,
                        "severity": event.severity,
                        "tee_verdict": event.tee_verdict,
                        "timestamp": event.timestamp.isoformat()
                    }))
            except RuntimeError:
                pass
        else:
            db.commit()

        return result

    def trigger_full_scan(self, db: Session) -> Dict:
        files = db.query(MonitoredFile).all()
        results = {"total": len(files), "matched": 0, "violations": 0}
        for f in files:
            res = self.verify_file_against_tee(db, f.file_path)
            if res.verdict == "MATCH":
                results["matched"] += 1
            else:
                results["violations"] += 1
        return results

    def approve_baseline_update(
        self,
        db: Session,
        file_path: str,
        new_hash: str,
        admin_username: str,
        admin_token: str,
        reason: str = None
    ) -> Tuple[bool, str]:
        seq = self.get_next_sequence()
        update_res = tee_service.adapter.approve_baseline_update(
            file_path=file_path,
            new_hash=new_hash,
            admin_token=admin_token,
            sequence_no=seq
        )

        if not update_res.success:
            return False, f"TEE rejected baseline update: {update_res.error}"

        # Update database records
        mon_file = db.query(MonitoredFile).filter(MonitoredFile.file_path == file_path).first()
        old_hash = mon_file.expected_hash if mon_file else None
        if mon_file:
            mon_file.expected_hash = new_hash
            mon_file.last_observed_hash = new_hash
            mon_file.integrity_status = "MATCH"
            mon_file.baseline_version = update_res.version

        # Record approval log
        approval = BaselineChangeApproval(
            file_path=file_path,
            old_hash=old_hash,
            new_hash=new_hash,
            status="APPROVED",
            requested_by=admin_username,
            approved_by=admin_username,
            reason=reason or "Authorized administrative update",
            resolved_at=datetime.now(timezone.utc),
            enclave_receipt=update_res.receipt_signature
        )
        db.add(approval)
        db.commit()

        return True, f"Baseline updated to version {update_res.version} successfully."

fim_service = FIMService()
