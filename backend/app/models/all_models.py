import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float, Index
from sqlalchemy.orm import relationship
from backend.app.database.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    hashed_password = Column(String(256), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

class MonitoringTarget(Base):
    __tablename__ = "monitoring_targets"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String(512), unique=True, nullable=False, index=True)
    is_recursive = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    description = Column(String(256), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    files = relationship("MonitoredFile", back_populates="target", cascade="all, delete-orphan")

class MonitoredFile(Base):
    __tablename__ = "monitored_files"

    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("monitoring_targets.id"), nullable=True)
    file_path = Column(String(512), unique=True, nullable=False, index=True)
    file_type = Column(String(32), default="regular", nullable=False)
    size_bytes = Column(Integer, default=0, nullable=False)
    permissions = Column(String(16), default="0644", nullable=False)
    expected_hash = Column(String(64), nullable=True, index=True)
    last_observed_hash = Column(String(64), nullable=True)
    integrity_status = Column(String(32), default="UNVERIFIED", nullable=False, index=True)
    # MATCH, TAMPERED, NEW, DELETED, PERMISSION_CHANGED, UNVERIFIED
    last_verified_at = Column(DateTime, nullable=True)
    baseline_version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    target = relationship("MonitoringTarget", back_populates="files")

class Baseline(Base):
    __tablename__ = "baselines"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(Integer, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    created_by = Column(String(64), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    total_files = Column(Integer, default=0, nullable=False)
    enclave_signature = Column(String(128), nullable=True)

    entries = relationship("BaselineEntry", back_populates="baseline", cascade="all, delete-orphan")

class BaselineEntry(Base):
    __tablename__ = "baseline_entries"

    id = Column(Integer, primary_key=True, index=True)
    baseline_id = Column(Integer, ForeignKey("baselines.id"), nullable=False, index=True)
    file_path = Column(String(512), nullable=False, index=True)
    sha256_hash = Column(String(64), nullable=False)
    size_bytes = Column(Integer, default=0, nullable=False)
    permissions = Column(String(16), default="0644", nullable=False)
    mtime = Column(Float, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    baseline = relationship("Baseline", back_populates="entries")

class BaselineChangeApproval(Base):
    __tablename__ = "baseline_change_approvals"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String(512), nullable=False, index=True)
    old_hash = Column(String(64), nullable=True)
    new_hash = Column(String(64), nullable=False)
    status = Column(String(32), default="PENDING", nullable=False) # PENDING, APPROVED, REJECTED
    requested_by = Column(String(64), nullable=False)
    approved_by = Column(String(64), nullable=True)
    reason = Column(Text, nullable=True)
    requested_at = Column(DateTime, default=utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    enclave_receipt = Column(String(256), nullable=True)

class IntegrityEvent(Base):
    __tablename__ = "integrity_events"

    id = Column(Integer, primary_key=True, index=True)
    event_uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False, index=True)
    timestamp = Column(DateTime, default=utcnow, nullable=False, index=True)
    file_path = Column(String(512), nullable=False, index=True)
    event_type = Column(String(48), nullable=False, index=True)
    # MODIFICATION, CREATION, DELETION, PERMISSION_CHANGE, BASELINE_VIOLATION, AGENT_INTERRUPT, TEE_ERROR, REPLAY_ATTACK, UNAUTHORIZED_UPDATE
    expected_hash = Column(String(64), nullable=True)
    observed_hash = Column(String(64), nullable=True)
    expected_permissions = Column(String(16), nullable=True)
    observed_permissions = Column(String(16), nullable=True)
    severity = Column(String(16), default="HIGH", nullable=False, index=True) # CRITICAL, HIGH, MEDIUM, LOW
    status = Column(String(24), default="OPEN", nullable=False, index=True) # OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE
    tee_verdict = Column(String(32), default="VERIFIED_TAMPERED", nullable=False)
    tee_receipt_sig = Column(String(128), nullable=True)
    tee_sequence = Column(Integer, nullable=True)
    source_agent = Column(String(64), default="host-agent-01", nullable=False)
    details = Column(Text, nullable=True)

class AgentStatusRecord(Base):
    __tablename__ = "agent_status"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(String(64), unique=True, nullable=False)
    hostname = Column(String(128), nullable=False)
    status = Column(String(32), default="ACTIVE", nullable=False) # ACTIVE, DEGRADED, STOPPED
    last_heartbeat = Column(DateTime, default=utcnow, nullable=False)
    monitored_paths_count = Column(Integer, default=0, nullable=False)
    events_generated_count = Column(Integer, default=0, nullable=False)
    version = Column(String(32), default="1.0.0", nullable=False)

class TEEStatusRecord(Base):
    __tablename__ = "tee_status"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(64), default="AWS Nitro Enclaves", nullable=False)
    deployment_mode = Column(String(48), default="DEVELOPMENT_SOFTWARE_ONLY", nullable=False)
    is_connected = Column(Boolean, default=True, nullable=False)
    last_attestation_status = Column(String(32), default="UNVERIFIED", nullable=False) # VERIFIED, REJECTED, UNVERIFIED, SIMULATED
    last_attestation_time = Column(DateTime, nullable=True)
    pcr0 = Column(String(96), nullable=True)
    pcr1 = Column(String(96), nullable=True)
    pcr2 = Column(String(96), nullable=True)
    enclave_cid = Column(Integer, nullable=True)
    enclave_port = Column(Integer, nullable=True)
    total_verifications = Column(Integer, default=0, nullable=False)
    total_rejections = Column(Integer, default=0, nullable=False)
    last_error = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

class TestExecution(Base):
    __tablename__ = "test_executions"

    id = Column(Integer, primary_key=True, index=True)
    test_name = Column(String(128), nullable=False, index=True)
    execution_time = Column(DateTime, default=utcnow, nullable=False)
    target_path = Column(String(512), nullable=True)
    expected_outcome = Column(String(128), nullable=False)
    actual_outcome = Column(String(128), nullable=False)
    status = Column(String(16), default="PASSED", nullable=False) # PASSED, FAILED
    latency_ms = Column(Float, default=0.0, nullable=False)
    event_id = Column(String(36), nullable=True)
    error_message = Column(Text, nullable=True)

class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id = Column(Integer, primary_key=True, index=True)
    run_uuid = Column(String(36), unique=True, default=lambda: str(uuid.uuid4()), nullable=False)
    timestamp = Column(DateTime, default=utcnow, nullable=False)
    mode = Column(String(48), nullable=False) # SOFTWARE_BASELINE vs TEE_HARDWARE
    num_files = Column(Integer, nullable=False)
    total_size_bytes = Column(Integer, nullable=False)
    hash_calc_time_ms = Column(Float, nullable=False)
    tee_comm_time_ms = Column(Float, nullable=False)
    end_to_end_latency_ms = Column(Float, nullable=False)
    detection_latency_ms = Column(Float, nullable=False)
    cpu_percent = Column(Float, default=0.0, nullable=False)
    memory_mb = Column(Float, default=0.0, nullable=False)
    throughput_files_per_sec = Column(Float, nullable=False)
    false_positives = Column(Integer, default=0, nullable=False)
    false_negatives = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=utcnow, nullable=False, index=True)
    admin_username = Column(String(64), nullable=False, index=True)
    action = Column(String(64), nullable=False, index=True)
    resource = Column(String(256), nullable=False)
    details = Column(Text, nullable=True)
    ip_address = Column(String(48), default="127.0.0.1", nullable=False)
