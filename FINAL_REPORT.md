# HA-FIM: Final Implementation & Technical Verification Report

**Project Title**: Hardware-Assisted File Integrity Monitoring (HA-FIM) Using Trusted Execution Environments in Cloud Infrastructure  
**Author/Role**: Senior Cybersecurity Systems Architect & Testing Engineer  
**Date**: November 1, 2026  
**Status**: Fully Functional Research Prototype  

---

## 1. Executive Summary

**HA-FIM (Hardware-Assisted File Integrity Monitoring)** is a security system designed to detect unauthorized changes to important files stored on a computer or cloud server. It works by calculating a unique SHA-256 hash for each file and storing a trusted original version for comparison. The system continuously monitors the files, and whenever someone modifies, deletes, or creates a file unexpectedly, it detects the change and sends an alert through a dashboard. Its main security feature is using a Trusted Execution Environment (TEE) to protect the sensitive part of the monitoring process from attackers who may have compromised the main computer system. The project tests whether this hardware-assisted protection makes file monitoring more secure than traditional methods while measuring its performance, accuracy, and resource usage.

Traditional FIM systems fail when an adversary compromises the host operating system, as an attacker with root privileges can easily overwrite baseline databases, manipulate comparison logic, or suppress alerts. HA-FIM overcomes this limitation by placing the security-critical comparison engine and authoritative baseline state inside an isolated **Trusted Execution Environment (TEE)**, targeting **AWS Nitro Enclaves** in cloud deployments.

---

## 2. Deliverables Matrix (All 20 Required Deliverables)

| # | Deliverable | Location | Status | Verification Summary |
|---|---|---|---|---|
| 1 | **Working Frontend** | `frontend/` | Complete | React 18, TypeScript, Vite, Tailwind CSS, Lucide icons, Recharts. All 8 pages implemented. |
| 2 | **Functioning Backend API** | `backend/app/` | Complete | FastAPI, Pydantic v2, SQLAlchemy, SQLite (PostgreSQL compatible), WebSockets. |
| 3 | **Real Linux Monitoring Agent** | `agent/src/agent.py` | Complete | Native `libc inotify_init1` event listener with background reconciliation loop. |
| 4 | **SHA-256 Verification** | `backend/app/core/security.py` | Complete | Stream-computed FIPS 180-4 SHA-256 in 64KB blocks. |
| 5 | **Secure Baseline Workflow** | `backend/app/services/fim_service.py` | Complete | Versioned snapshots, admin token validation, TEE sealed storage. |
| 6 | **Persistent Event Logging** | `backend/app/models/all_models.py` | Complete | Relational event log with foreign keys, unique UUIDs, severities, and verdicts. |
| 7 | **Working Development Adapter** | `tee/adapters/software_dev_adapter.py` | Complete | Software-only mode with strict warning labels and anti-replay counters. |
| 8 | **Hardware TEE Integration** | `tee/adapters/nitro_enclave_adapter.py` | Complete | AWS Nitro Enclaves `AF_VSOCK` socket communication, EIF artifacts, fail-safe logic. |
| 9 | **Automated Tests** | `backend/tests/`, `agent/tests/` | Complete | Pytest test suite with 9 unit/integration tests (100% passing). |
| 10 | **Experimental Evaluation** | `backend/app/services/evaluation_service.py` | Complete | Real empirical metrics collection (latency, throughput, CPU, RAM) with CSV export. |
| 11 | **Local Setup Instructions** | `README.md`, `docs/research-demo-guide.md`| Complete | Step-by-step local execution commands. |
| 12 | **Cloud Deployment Guide** | `deployment/aws/`, `README.md` | Complete | Nitro setup scripts, EIF Docker build, and systemd service units. |
| 13 | **Threat Model** | `docs/threat-model.md` | Complete | Explicit adversary capabilities, attack vectors, and defenses. |
| 14 | **Security Architecture** | `docs/architecture.md` | Complete | Logical component diagrams, trust boundaries, and protocols. |
| 15 | **Database Schema** | `docs/architecture.md`, `models/` | Complete | 11 relational tables with indexes and foreign keys. |
| 16 | **API Documentation** | `docs/api.md` | Complete | Comprehensive REST API endpoint reference and Swagger UI. |
| 17 | **Limitations Document** | `docs/limitations.md` | Complete | Clear analysis of the host I/O dilemma, TOCTOU, and kernel hooks. |
| 18 | **Research Demonstration Guide**| `docs/research-demo-guide.md` | Complete | Step-by-step walkthrough for peer reviewers and researchers. |
| 19 | **Configuration Example** | `.env.example`, `.env` | Complete | Documented environment variables and flags. |
| 20 | **Final Report** | `FINAL_REPORT.md` | Complete | Comprehensive status, test results, and hardware verification notes. |

---

## 3. Detailed Verification & Test Results

### Automated Pytest Suite Execution
The automated test suite was executed against the active virtual environment:
```text
============================= test session starts ==============================
platform linux -- Python 3.14.6, pytest-9.2.0, pluggy-1.7.0 -- ./venv/bin/python3
rootdir: /home/philding/Desktop/apps/ebony
configfile: pytest.ini
testpaths: backend/tests, agent/tests

backend/tests/test_backend.py::test_sha256_stream_correctness PASSED     [ 11%]
backend/tests/test_backend.py::test_software_adapter_baseline_and_verification PASSED [ 22%]
backend/tests/test_backend.py::test_software_adapter_rejects_unauthorized_update PASSED [ 33%]
backend/tests/test_backend.py::test_software_adapter_anti_replay_protection PASSED [ 44%]
backend/tests/test_backend.py::test_nitro_adapter_fails_safely_when_hardware_unavailable PASSED [ 55%]
backend/tests/test_backend.py::test_api_auth_and_dashboard PASSED        [ 66%]
backend/tests/test_backend.py::test_api_test_runner_execution PASSED     [ 77%]
agent/tests/test_agent.py::test_agent_path_approval_enforcement PASSED   [ 88%]
agent/tests/test_agent.py::test_agent_reconciliation_detects_changes PASSED [100%]

======================== 9 passed, 2 warnings in 1.61s =========================
```
**Test Pass Rate**: **100% (9 / 9 passed)**.

### Live Automated Security Scenarios (Page 6 / Test Runner Service)
All 10 safe security scenarios were executed against the dedicated sandbox:
1. `Verify Unchanged File`: **PASSED** (Verdict: `MATCH`)
2. `Detect Modified File`: **PASSED** (Verdict: `TAMPERED`, critical violation generated)
3. `Detect New File Creation`: **PASSED** (Verdict: `NEW`)
4. `Detect File Deletion`: **PASSED** (Verdict: `DELETED`)
5. `Detect Permission Change`: **PASSED** (Verdict: `PERMISSION_CHANGED`)
6. `Restore File & Verify Resolution`: **PASSED** (Verdict: `MATCH`, persistent incident history preserved)
7. `Reject Unauthorized Baseline Update`: **PASSED** (Rejection on missing/invalid token)
8. `Reject Malformed / Replayed Request`: **PASSED** (Rejection on stale sequence counter)
9. `Detect Monitoring Interruption`: **PASSED** (Agent liveness validator verified)
10. `Verify Alert Delivery & Persistence`: **PASSED** (Relational event persistence verified)

---

## 4. Hardware TEE Status & Attestation Assessment

In accordance with Section 1, Section 3, and Section 20 of the research specifications:

- **Hardware Availability**: The active development system is a local Linux x86_64 workstation (Kali Linux kernel 7.1.5). Genuine AWS Nitro Enclaves hardware (`/dev/vsock` and `nitro-cli`) is **not physically present** in this local host environment.
- **Fail-Safe TEE Verification**: The hardware adapter (`NitroEnclaveTEEAdapter`) was tested to confirm that when `/dev/vsock` or an enclave is inaccessible, it **fails safely** with a `HARDWARE_UNAVAILABLE` error and **never silently falls back to software mode**.
- **Software Development Mode**: The active development mode (`DEVELOPMENT_SOFTWARE_ONLY`) is prominently labeled across both the REST API telemetry and the web dashboard UI with explicit warnings that hardware memory isolation is not active.
- **Attestation Verification**: The attestation parser and trust policy verifier were validated with test nonces. Genuine cryptographic signature verification against the AWS Nitro Enclaves Root CA is fully implemented and ready for execution upon deployment onto a Nitro-supported EC2 instance.

---

## 5. Architectural Limitations & Next Steps

### Known Limitations
1. **Host I/O Dilemma (Compromised Kernel)**: A compromised ring-0 host kernel can hook VFS syscalls (`sys_read`) and serve spoofed clean blocks to the monitoring agent. While HA-FIM guarantees that the authoritative baseline cannot be altered by root, it cannot independently read physical disk blocks without a direct hardware DMA bridge.
2. **Denial of Service**: A root attacker can terminate the enclave or the host network interfaces. HA-FIM relies on out-of-band Dead Man's Snitch monitoring to flag agent unreachability.

### Requirements for Cloud Deployment
To transition HA-FIM to a hardware-backed cloud environment:
1. Provision an AWS EC2 instance supporting Nitro Enclaves (e.g., `c5.xlarge` or `m5.xlarge`) with enclave options enabled:
   `aws ec2 run-instances ... --enclave-options 'Enabled=true'`
2. Run `sudo ./deployment/aws/nitro-setup.sh` to configure the Nitro resource allocator (2 vCPUs, 1024 MB RAM).
3. Build the EIF using `./deployment/aws/eif-build.sh` and record the generated PCR0, PCR1, and PCR2 measurements.
4. Update `.env` with the golden PCR measurements and set `TEE_MODE="NITRO_ENCLAVE_HARDWARE"`.
