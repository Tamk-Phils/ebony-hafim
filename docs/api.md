# HA-FIM: REST API Documentation (v1)

Base URL: `/api/v1`

All protected endpoints require an `Authorization: Bearer <JWT>` header obtained via `/api/v1/auth/login`.

---

### 1. Authentication Endpoints

#### `POST /api/v1/auth/setup`
- **Description**: First-run administrator initialization. Allowed only when 0 admins exist in the database.
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "StrongPassword123!"
  }
  ```
- **Response**: `200 OK` (AdminProfile object)

#### `POST /api/v1/auth/login`
- **Description**: Authenticates administrator credentials and returns an access token.
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "StrongPassword123!"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "expires_in_minutes": 720,
    "username": "admin"
  }
  ```

#### `GET /api/v1/auth/me`
- **Description**: Retrieves current authenticated administrator profile.
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`

---

### 2. Dashboard Endpoints

#### `GET /api/v1/dashboard/summary`
- **Description**: Aggregates real-time security statistics, active violation counts, TEE enclave health, and recent event stream.
- **Response**: `200 OK`
  ```json
  {
    "total_monitored_files": 12,
    "files_matching_baseline": 11,
    "files_with_violations": 1,
    "critical_events_count": 1,
    "high_events_count": 0,
    "monitoring_agent_status": "ACTIVE",
    "tee_connection_status": true,
    "tee_deployment_mode": "DEVELOPMENT_SOFTWARE_ONLY",
    "tee_hardware_backed": false,
    "tee_hardware_warning": "WARNING: Hardware-assisted isolation is NOT ACTIVE...",
    "last_scan_time": "2026-11-01T04:10:00Z",
    "last_baseline_version": 2,
    "recent_events": [...],
    "detection_activity_chart": [...]
  }
  ```

#### `GET /api/v1/dashboard/health`
- **Description**: Diagnostic endpoint reporting connectivity across TEE engine, host agent, and database.

---

### 3. Monitored Files & Target Management

#### `GET /api/v1/monitored-files`
- **Query Params**: `search`, `integrity_status` (`MATCH`, `TAMPERED`, `NEW`, `DELETED`, `PERMISSION_CHANGED`), `limit`, `offset`.
- **Response**: `200 OK` (Array of MonitoredFile objects).

#### `POST /api/v1/monitored-files/targets`
- **Description**: Registers an approved directory root for monitoring.
- **Request Body**:
  ```json
  {
    "path": "/home/philding/Desktop/apps/ebony/sandbox",
    "is_recursive": true,
    "description": "Critical system configuration root"
  }
  ```

#### `DELETE /api/v1/monitored-files/targets/{id}`
- **Description**: Removes a target root from active monitoring.

#### `POST /api/v1/monitored-files/{id}/verify`
- **Description**: Triggers an immediate cryptographic cross-reference against the TEE comparison engine for a single file.

#### `POST /api/v1/monitored-files/scan`
- **Description**: Triggers a full verification sweep across all targets.

---

### 4. Baseline Management

#### `GET /api/v1/baselines`
- **Description**: Lists historical baseline revisions with enclave signatures and timestamps.

#### `POST /api/v1/baselines/initialize`
- **Description**: Generates a new authoritative baseline snapshot inside the TEE across all active targets.
- **Request Body**:
  ```json
  {
    "notes": "Post-deployment production baseline v1.0"
  }
  ```

#### `POST /api/v1/baselines/approve-update`
- **Description**: Grants administrative approval for an observed hash change, updating the authoritative TEE baseline.
- **Request Body**:
  ```json
  {
    "file_path": "/path/to/file",
    "new_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "reason": "Authorized software patch"
  }
  ```

---

### 5. Integrity Events & Export

#### `GET /api/v1/events`
- **Query Params**: `search`, `severity`, `event_type`, `status`.

#### `PATCH /api/v1/events/{id}/status`
- **Request Body**: `{"status": "RESOLVED"}`

#### `GET /api/v1/events/export`
- **Description**: Streams a downloadable forensic CSV report containing all integrity violations and TEE verdict receipts.

---

### 6. TEE Operations & Attestation

#### `GET /api/v1/tee/status`
- **Description**: Retrieves TEE hardware mode, PCR0/1/2 measurements, and connection telemetry.

#### `POST /api/v1/tee/attestation`
- **Request Body**: `{"nonce": "optional_hex_nonce"}`
- **Description**: Challenges the enclave to produce a cryptographically verifiable attestation document.

---

### 7. Testing & Evaluation

#### `POST /api/v1/tests/run`
- **Description**: Safely runs the 10 automated integrity attack and defense test scenarios in the sandbox.

#### `POST /api/v1/evaluations/run`
- **Request Body**: `{"num_files": 50, "file_size_kb": 32}`
- **Description**: Runs empirical performance benchmarks measuring SHA-256 calculation latency, TEE roundtrip overhead, and CPU/memory utilization.

#### `GET /api/v1/evaluations/export`
- **Description**: Exports empirical benchmark results as a CSV file.

---

### 8. Audit Logs

#### `GET /api/v1/audit-logs`
- **Description**: Returns immutable audit trail of administrative operations.
