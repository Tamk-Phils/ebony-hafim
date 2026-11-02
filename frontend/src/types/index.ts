export interface AdminProfile {
  id: number;
  username: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface DashboardSummary {
  total_monitored_files: number;
  files_matching_baseline: number;
  files_with_violations: number;
  critical_events_count: number;
  high_events_count: number;
  monitoring_agent_status: string;
  tee_connection_status: boolean;
  tee_deployment_mode: string;
  tee_hardware_backed: boolean;
  tee_hardware_warning?: string;
  last_scan_time?: string;
  last_baseline_version: number;
  recent_events: Array<{
    id: number;
    uuid: string;
    timestamp: string;
    file_path: string;
    event_type: string;
    severity: string;
    status: string;
    tee_verdict: string;
  }>;
  detection_activity_chart: Array<{
    type: string;
    count: number;
  }>;
}

export interface MonitoredFile {
  id: number;
  target_id?: number;
  file_path: string;
  file_type: string;
  size_bytes: number;
  permissions: string;
  expected_hash?: string;
  last_observed_hash?: string;
  integrity_status: string; // MATCH, TAMPERED, NEW, DELETED, PERMISSION_CHANGED, UNVERIFIED
  last_verified_at?: string;
  baseline_version: number;
}

export interface MonitoringTarget {
  id: number;
  path: string;
  is_recursive: boolean;
  is_active: boolean;
  description?: string;
  created_at: string;
}

export interface Baseline {
  id: number;
  version: number;
  created_at: string;
  created_by: string;
  is_active: boolean;
  notes?: string;
  total_files: number;
  enclave_signature?: string;
}

export interface BaselineEntry {
  id: number;
  file_path: string;
  sha256_hash: string;
  size_bytes: number;
  permissions: string;
}

export interface BaselineApproval {
  id: number;
  file_path: string;
  old_hash?: string;
  new_hash: string;
  status: string;
  requested_by: string;
  approved_by?: string;
  reason?: string;
  requested_at: string;
  resolved_at?: string;
  enclave_receipt?: string;
}

export interface IntegrityEvent {
  id: number;
  event_uuid: string;
  timestamp: string;
  file_path: string;
  event_type: string;
  expected_hash?: string;
  observed_hash?: string;
  expected_permissions?: string;
  observed_permissions?: string;
  severity: string; // CRITICAL, HIGH, MEDIUM, LOW
  status: string; // OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE
  tee_verdict: string;
  tee_receipt_sig?: string;
  tee_sequence?: number;
  source_agent: string;
  details?: string;
}

export interface TEEStatus {
  platform: string;
  mode: string;
  is_connected: boolean;
  hardware_backed: boolean;
  hardware_warning?: string;
  attestation_status: string;
  enclave_cid?: number;
  enclave_port?: number;
  measurements: Record<string, string>;
  total_verifications: number;
  total_rejections: number;
  last_error?: string;
}

export interface AttestationResult {
  is_valid: boolean;
  trust_policy_satisfied: boolean;
  pcr0?: string;
  pcr1?: string;
  pcr2?: string;
  signer_ca?: string;
  nonce: string;
  issued_at?: string;
  details: string;
}

export interface TestResultItem {
  id: number;
  test_name: string;
  status: string; // PASSED, FAILED
  expected_outcome: string;
  actual_outcome: string;
  latency_ms: number;
  event_id?: string;
  error_message?: string;
  execution_time: string;
}

export interface BenchmarkResult {
  id: number;
  run_uuid: string;
  mode: string;
  num_files: number;
  total_size_bytes: number;
  hash_calc_time_ms: number;
  tee_comm_time_ms: number;
  end_to_end_latency_ms: number;
  detection_latency_ms: number;
  cpu_percent: number;
  memory_mb: number;
  throughput_files_per_sec: number;
  false_positives: number;
  false_negatives: number;
  timestamp: string;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  admin_username: string;
  action: string;
  resource: string;
  details?: string;
  ip_address: string;
}
