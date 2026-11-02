# HA-FIM: Testing & Security Validation Plan

### 1. Test Suite Architecture

HA-FIM implements automated testing across unit, integration, and security verification tiers:

```
tests/
├── Unit Tests
│   ├── SHA-256 Hashing Accuracy (FIPS 180-4 reference vectors)
│   ├── Anti-Replay Monotonic Sequence Enforcement
│   ├── Password Hashing & Verification (PBKDF2-HMAC-SHA256)
│   └── Host Path Approval & Canonicalization
├── TEE Adapter Contracts
│   ├── Software Development Adapter (Simulated state, strict rejection)
│   ├── AWS Nitro Enclaves Adapter (Fail-closed behavior on absent hardware)
│   └── Remote Attestation Policy Checking
├── Host Agent Verification
│   ├── Inotify Event Propagation
│   └── Periodic Background Reconciliation Sweep
└── Safe Automated Scenario Suite (10 Live Scenarios)
```

---

### 2. The 10 Live Scenario Tests

Executed programmatically via `POST /api/v1/tests/run` or via the web UI (Page 6: Testing & Verification):

| # | Scenario Name | Test Procedure | Expected Outcome |
| :--- | :--- | :--- | :--- |
| **1** | Verify Unchanged File | Baseline initialized; file unmodified; verification executed. | Verdict: `MATCH`. Expected and observed hashes identical. |
| **2** | Detect Modified File | Content appended to monitored file. | Verdict: `TAMPERED`. `CRITICAL` severity event generated. |
| **3** | Detect New File Creation | Untracked script created in monitored directory root. | Verdict: `NEW`. `MEDIUM` severity event generated. |
| **4** | Detect File Deletion | Monitored file removed from disk. | Verdict: `DELETED`. `HIGH` severity event generated. |
| **5** | Detect Permission Change | File permissions changed from `0600` to `0777`. | Verdict: `PERMISSION_CHANGED`. `HIGH` event generated. |
| **6** | Restore File & Verify Resolution | Tampered file restored to exact original content. | Verdict: `MATCH`. Original security incident preserved in history. |
| **7** | Reject Unauthorized Baseline Update | Update request submitted with invalid admin bearer token. | Operation REJECTED. Enclave signature withheld. |
| **8** | Reject Malformed / Replayed Request | Verification request submitted with stale sequence number (`seq <= last`). | Verdict: `REPLAY_DETECTED`. Request rejected. |
| **9** | Detect Monitoring Interruption | Agent liveness threshold evaluated against simulated heartbeat stall. | Health monitor flags agent as `DEGRADED` / `INTERRUPTED`. |
| **10** | Verify Alert Delivery & Persistence | Event table queried after multiple violations. | All events persisted with foreign keys and unique UUIDs. |

---

### 3. Execution Commands

#### Run Full Automated Pytest Suite:
```bash
./venv/bin/pytest -v
```

#### Run Live Controlled Security Scenarios:
```bash
./venv/bin/python -c "
from backend.app.database.session import SessionLocal
from backend.app.core.security import create_access_token
from backend.app.services.test_runner_service import test_runner_service

db = SessionLocal()
token = create_access_token('admin')
results = test_runner_service.run_all_tests(db, token)
for r in results:
    print(f'[{r[\"status\"]}] {r[\"test_name\"]} ({r[\"latency_ms\"]} ms)')
db.close()
"
```
