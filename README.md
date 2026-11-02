# HA-FIM: Hardware-Assisted File Integrity Monitoring

[![Architecture](https://img.shields.io/badge/Architecture-TEE%20Protected%20Baseline-cyan.svg)](docs/architecture.md)
[![TEE Platform](https://img.shields.io/badge/TEE-AWS%20Nitro%20Enclaves-blue.svg)](docs/security-model.md)
[![Tests](https://img.shields.io/badge/Tests-100%25%20Passing-emerald.svg)](docs/testing.md)
[![License](https://img.shields.io/badge/License-Academic%20Research-purple.svg)](README.md)

**HA-FIM (Hardware-Assisted File Integrity Monitoring)** is a security system designed to detect unauthorized changes to important files stored on a computer or cloud server. It works by calculating a unique SHA-256 hash for each file and storing a trusted original version for comparison. The system continuously monitors the files, and whenever someone modifies, deletes, or creates a file unexpectedly, it detects the change and sends an alert through a dashboard. Its main security feature is using a Trusted Execution Environment (TEE) to protect the sensitive part of the monitoring process from attackers who may have compromised the main computer system. The project will test whether this hardware-assisted protection makes file monitoring more secure than traditional methods while measuring its performance, accuracy, and resource usage.

Based on the research proposal:
> *“Hardware-Assisted File Integrity Monitoring Using Trusted Execution Environments (TEEs) in Cloud Infrastructure.”*

Traditional FIM systems depend directly on the host operating system. If an attacker achieves root or kernel compromise, they can alter the trusted baseline database, silence the monitoring agent, or suppress alerts. **HA-FIM solves this fundamental limitation by sealing the authoritative baseline and comparison logic inside an isolated enclave (AWS Nitro Enclaves)**, communicating exclusively across a narrow virtual socket (`AF_VSOCK`) interface with cryptographic attestation and anti-replay counters.

---

## Architecture Overview

```
[ Host Filesystem (Untrusted) ]
           │
           ▼
[ Host Monitoring Agent ] ──(inotify + sweep)──> [ FastAPI Backend Control Plane ]
           │                                                    │
           │ (AF_VSOCK / Length-Prefixed Frames)                │
           ▼                                                    ▼
[ TEE Comparison Engine (Nitro Enclave) ]             [ React / TypeScript Dashboard ]
  ├── Autoritative Sealed Baseline (RAM only)           ├── 8 Security Operations Pages
  ├── Anti-Replay Monotonic Counters                    ├── Live WebSocket Alert Stream
  └── Enclave Signed Receipts (HMAC/Ed25519)            └── Empirical Benchmarks
```

---

## Key Features

1. **Tamper-Resistant Authoritative Baseline**: Stored exclusively inside enclave memory; cannot be overwritten by host root or hypervisor attacks.
2. **Dual-Path TEE Adapter Architecture**:
   - `DEVELOPMENT_SOFTWARE_ONLY`: Fully operational emulation mode for local testing without cloud fees. Prominently labels results as software-only.
   - `NITRO_ENCLAVE_HARDWARE`: Connects to AWS Nitro Enclaves over `AF_VSOCK`, validates hardware PCR measurements (PCR0, PCR1, PCR2), and fails safely if the enclave is unavailable (never silently falls back).
3. **Real Linux Filesystem Agent**: Leverages non-blocking `libc inotify_init1` filesystem events combined with scheduled background reconciliation sweeps to counter dropped events.
4. **Anti-Replay Protection**: Strict monotonic sequence counter validation rejects replayed clean-state tokens.
5. **Administrative Baseline Approval Workflow**: Sensitive baseline updates require authenticated admin credentials, justification notes, and cryptographic signing.
6. **Empirical Evaluation Suite**: Real empirical benchmarks measuring SHA-256 calculation latency, TEE communication overhead, throughput, and CPU/RAM footprints with CSV export.
7. **8-Page Security Operations Dashboard**:
   - Page 1: Overview Dashboard (Live telemetry & detection activity)
   - Page 2: Monitored Files (Table, details, verify scan, approve update)
   - Page 3: Integrity Events (Severity badges, forensic inspection, CSV export)
   - Page 4: Baseline Management (Revisions, entries inspection, initialization)
   - Page 5: TEE & Attestation (Platform status, PCRs, remote attestation challenge)
   - Page 6: Testing & Verification (10 live automated security scenarios)
   - Page 7: Performance Benchmarks (Empirical throughput & latency charts)
   - Page 8: Audit & Configuration (Privileged audit ledger, parameters)

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Node.js 18+ (Tested on Node.js 24)
- Linux (x86_64)

### 1. Backend Setup
```bash
# Set up virtual environment
python3 -m venv venv
./venv/bin/pip install -r backend/requirements.txt

# Start backend server
./venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
*Interactive Swagger documentation: `http://127.0.0.1:8000/docs`*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Access web interface: `http://localhost:5173`*

### 3. Default Research Credentials
- **Username**: `admin`
- **Password**: `CyberSecResearch2026!`

---

## Running Automated Tests

Run the full pytest suite (covering unit tests, cryptographic vectors, TEE adapters, anti-replay, and agent reconciliation):
```bash
./venv/bin/pytest -v
```

Execute the CLI empirical performance benchmark:
```bash
./venv/bin/python evaluation/scripts/run_benchmarks.py --files 50 --size-kb 32
```

---

## AWS Nitro Enclaves Cloud Deployment

For deploying the genuine hardware-backed enclave on an EC2 instance (e.g. `c5.xlarge` with `--enclave-options 'Enabled=true'`):

1. **Install Nitro Prerequisites**:
   ```bash
   chmod +x deployment/aws/nitro-setup.sh
   sudo ./deployment/aws/nitro-setup.sh
   ```

2. **Build and Run the Enclave**:
   ```bash
   chmod +x deployment/aws/eif-build.sh
   ./deployment/aws/eif-build.sh
   ```

3. **Configure Environment**:
   In `.env`:
   ```bash
   TEE_MODE="NITRO_ENCLAVE_HARDWARE"
   NITRO_VSOCK_CID=16
   NITRO_VSOCK_PORT=5000
   ```

---

## Vercel Deployment (Frontend Control Plane)

The React frontend control plane is pre-configured for instant zero-config deployment to **Vercel**:

1. Connect this repository to your Vercel account.
2. Vercel automatically detects the root [`vercel.json`](vercel.json) and builds `frontend/dist`.
3. Add the optional environment variable `VITE_API_BASE_URL` pointing to your deployed backend (e.g. `https://api.hafim.yourdomain.com`).
4. Full details: [Vercel Deployment Guide](docs/vercel-deployment.md).

---

## Documentation Index

- [System Architecture](docs/architecture.md)
- [Threat Model](docs/threat-model.md)
- [Security Model & Attestation](docs/security-model.md)
- [Architectural Limitations](docs/limitations.md)
- [REST API Specification](docs/api.md)
- [Testing & Validation Guide](docs/testing.md)
- [Empirical Evaluation Framework](docs/evaluation.md)
- [Research Demonstration Walkthrough](docs/research-demo-guide.md)
- [Vercel Deployment Guide](docs/vercel-deployment.md)
- [Final Implementation Report](FINAL_REPORT.md)
