# HA-FIM: Academic Research & Demonstration Guide

This guide provides step-by-step instructions for researchers, peer reviewers, and security administrators to evaluate the **Hardware-Assisted File Integrity Monitoring (HA-FIM)** prototype.

---

### 1. Prerequisites and Startup

#### Step 1: Start the Backend Control Plane
In terminal 1:
```bash
cd /home/philding/Desktop/apps/ebony
./venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
*API documentation and interactive Swagger UI are available at `http://127.0.0.1:8000/docs`.*

#### Step 2: Start the Frontend React Dashboard
In terminal 2:
```bash
cd /home/philding/Desktop/apps/ebony/frontend
npm run dev
```
*Access the dashboard in your web browser at `http://localhost:5173`.*

---

### 2. Demonstration Walkthrough

#### Step 1: Authentication
- Open `http://localhost:5173`.
- Authenticate using the default research credentials:
  - **Username**: `admin`
  - **Password**: `CyberSecResearch2026!`

#### Step 2: Overview Dashboard (Page 1)
- Inspect the live system telemetry:
  - Total Monitored Targets: `1` (`/sandbox`)
  - TEE Protected Boundary: `SOFTWARE EMULATION` (or `AWS NITRO ENCLAVE` if deployed on Nitro EC2)
  - Deployment Warning Banner: Explicit notice that local development mode does not provide hardware memory encryption.

#### Step 3: Establish Ground Truth Baseline (Page 4)
- Navigate to **Baseline Management** (`/baselines`).
- Click **Initialize New Baseline**.
- Enter revision notes: *"Baseline Demonstration v1.0"*.
- Click **Initialize Baseline**.
- Observe that the comparison engine computes SHA-256 hashes for all target files and seals them inside the TEE with an enclave cryptographic signature.

#### Step 4: Live File Tampering Attack (Demonstrating Violation Detection)
Open a terminal and inject an unauthorized change into a monitored file:
```bash
echo "MALICIOUS_BACKDOOR_INJECTION=1" >> /home/philding/Desktop/apps/ebony/sandbox/system_auth.conf
```
- In the dashboard:
  - Notice the immediate red alert banner at the top of the screen: *"CRITICAL INTEGRITY VIOLATION DETECTED: MODIFICATION on system_auth.conf"*.
  - Navigate to **Integrity Events** (`/events`).
  - Click **Inspect** on the incident to review:
    - Authoritative expected SHA-256 (TEE sealed) vs. Observed SHA-256 on disk.
    - TEE cryptographic verdict: `TAMPERED`.
    - Enclave HMAC receipt signature and anti-replay sequence number.

#### Step 5: Authorize Legitimate Baseline Update Workflow (Page 2)
- Navigate to **Monitored Files** (`/files`).
- Observe `system_auth.conf` is marked with a red `TAMPERED` status badge.
- Click **Approve Update**.
- Enter an administrative justification: *"Approved security hotfix 1.0.1"*.
- Click **Sign & Commit to TEE**.
- The TEE engine validates the administrator's JWT signature, checks the monotonic counter against replay attacks, updates its internal baseline, and marks the file as clean (`MATCH`).

#### Step 6: Automated Security Scenarios (Page 6)
- Navigate to **Testing & Verification** (`/testing`).
- Click **Run Automated Test Suite**.
- Observe 10 automated attack and defense scenarios executed live inside the safe sandbox:
  1. Verify Unchanged File
  2. Detect Modified File
  3. Detect New File Creation
  4. Detect File Deletion
  5. Detect Permission Change
  6. Restore File & Verify Incident Retention
  7. Reject Unauthorized Baseline Update
  8. Reject Replayed Sequence Numbers
  9. Detect Monitoring Interruption
  10. Verify Alert Delivery & Persistence

#### Step 7: Empirical Performance Benchmarking (Page 7)
- Navigate to **Performance Benchmarks** (`/performance`).
- Select batch size (e.g., 50 files) and file payload size (e.g., 32 KB).
- Click **Execute Empirical Benchmark**.
- Review quantitative measurements:
  - Throughput (files/sec)
  - End-to-end verification latency (ms)
  - Cryptographic hashing calculation time (ms)
  - TEE communication overhead (ms)
  - CPU and Memory footprints
- Click **Export Benchmark CSV** to download empirical research datasets.
