from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

# --- Auth ---
class SetupAdminRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8)

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    username: str

class AdminProfileResponse(BaseModel):
    id: int
    username: str
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None

# --- Dashboard Summary ---
class DashboardSummaryResponse(BaseModel):
    total_monitored_files: int
    files_matching_baseline: int
    files_with_violations: int
    critical_events_count: int
    high_events_count: int
    monitoring_agent_status: str
    tee_connection_status: bool
    tee_deployment_mode: str
    tee_hardware_backed: bool
    tee_hardware_warning: Optional[str]
    last_scan_time: Optional[datetime]
    last_baseline_version: int
    recent_events: List[Dict[str, Any]]
    detection_activity_chart: List[Dict[str, Any]]

# --- Monitored Files & Targets ---
class AddTargetRequest(BaseModel):
    path: str
    is_recursive: bool = True
    description: Optional[str] = None

class TargetResponse(BaseModel):
    id: int
    path: str
    is_recursive: bool
    is_active: bool
    description: Optional[str]
    created_at: datetime

class MonitoredFileResponse(BaseModel):
    id: int
    target_id: Optional[int]
    file_path: str
    file_type: str
    size_bytes: int
    permissions: str
    expected_hash: Optional[str]
    last_observed_hash: Optional[str]
    integrity_status: str
    last_verified_at: Optional[datetime]
    baseline_version: int

# --- Baselines ---
class BaselineInitRequest(BaseModel):
    notes: Optional[str] = None

class BaselineEntryResponse(BaseModel):
    id: int
    file_path: str
    sha256_hash: str
    size_bytes: int
    permissions: str

class BaselineResponse(BaseModel):
    id: int
    version: int
    created_at: datetime
    created_by: str
    is_active: bool
    notes: Optional[str]
    total_files: int
    enclave_signature: Optional[str]

class BaselineApprovalRequest(BaseModel):
    file_path: str
    new_hash: str
    reason: Optional[str] = None

class BaselineApprovalResponse(BaseModel):
    id: int
    file_path: str
    old_hash: Optional[str]
    new_hash: str
    status: str
    requested_by: str
    approved_by: Optional[str]
    reason: Optional[str]
    requested_at: datetime
    resolved_at: Optional[datetime]
    enclave_receipt: Optional[str]

# --- Integrity Events ---
class IntegrityEventResponse(BaseModel):
    id: int
    event_uuid: str
    timestamp: datetime
    file_path: str
    event_type: str
    expected_hash: Optional[str]
    observed_hash: Optional[str]
    expected_permissions: Optional[str]
    observed_permissions: Optional[str]
    severity: str
    status: str
    tee_verdict: str
    tee_receipt_sig: Optional[str]
    tee_sequence: Optional[int]
    source_agent: str
    details: Optional[str]

class EventStatusUpdateRequest(BaseModel):
    status: str # OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE

# --- TEE Status & Attestation ---
class TEEStatusResponse(BaseModel):
    platform: str
    mode: str
    is_connected: bool
    hardware_backed: bool
    hardware_warning: Optional[str]
    attestation_status: str
    enclave_cid: Optional[int]
    enclave_port: Optional[int]
    measurements: Dict[str, str]
    total_verifications: int
    total_rejections: int
    last_error: Optional[str]

class AttestationRequest(BaseModel):
    nonce: Optional[str] = None

class AttestationResponse(BaseModel):
    is_valid: bool
    trust_policy_satisfied: bool
    pcr0: Optional[str]
    pcr1: Optional[str]
    pcr2: Optional[str]
    signer_ca: Optional[str]
    nonce: str
    issued_at: Optional[str]
    details: str

# --- Testing ---
class TestResultItem(BaseModel):
    id: int
    test_name: str
    status: str
    expected_outcome: str
    actual_outcome: str
    latency_ms: float
    event_id: Optional[str]
    error_message: Optional[str]
    execution_time: str

# --- Evaluation ---
class RunBenchmarkRequest(BaseModel):
    num_files: int = 50
    file_size_kb: int = 32

class BenchmarkResultResponse(BaseModel):
    id: int
    run_uuid: str
    mode: str
    num_files: int
    total_size_bytes: int
    hash_calc_time_ms: float
    tee_comm_time_ms: float
    end_to_end_latency_ms: float
    detection_latency_ms: float
    cpu_percent: float
    memory_mb: float
    throughput_files_per_sec: float
    false_positives: int
    false_negatives: int
    timestamp: str

# --- Audit Logs ---
class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    admin_username: str
    action: str
    resource: str
    details: Optional[str]
    ip_address: str
