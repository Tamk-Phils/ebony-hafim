# HA-FIM: Multi-Cloud Deployment Guide (Linux & Windows)

This guide provides end-to-end instructions for deploying the **Hardware-Assisted File Integrity Monitoring (HA-FIM)** system across **Linux** (AWS Nitro Enclaves / Ubuntu) and **Windows Server** (AWS EC2 / Azure Confidential Computing) cloud environments.

---

## 1. Architectural Overview & Mental Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                      UNTRUSTED HOST OPERATING SYSTEM                   │
│   (Linux: Ubuntu 22.04 / 24.04 LTS   OR   Windows Server 2022 / 2025)   │
│                                                                        │
│   ┌───────────────────────────┐      ┌─────────────────────────────┐   │
│   │ Monitored Filesystem Root │      │ Host Monitoring Agent       │   │
│   │ (C:\Windows\System32...   │◄────►│ - inotify (Linux libc)      │   │
│   │  or /etc, /bin, sandbox)  │      │ - Win32 Watcher (Windows)   │   │
│   └───────────────────────────┘      │ - Periodic Reconciliation   │   │
│                                      └──────────────┬──────────────┘   │
└─────────────────────────────────────────────────────┼──────────────────┘
                                                      │
                       Isolated Boundary:             │ SHA-256 Digest &
                       AF_VSOCK / Secure Channel      │ Monotonic Counter
                       (No Host Kernel Access)        ▼
┌────────────────────────────────────────────────────────────────────────┐
│            TRUSTED EXECUTION ENVIRONMENT (TEE) "LOCKED OFFICE"         │
│                 (AWS Nitro Enclaves / AMD SEV-SNP CVM)                 │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Authoritative Sealed Baseline (RAM-only cryptographic hashes)  │   │
│   │ Anti-Replay Monotonic Sequence Counter                         │   │
│   │ Enclave Cryptographic Comparison Engine                        │   │
│   │ Cryptographic Signed Verification Receipts (HMAC / Ed25519)    │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

> **The "Locked Office" Principle**: Traditional FIM software stores baselines on the host disk or in host OS memory. If an attacker gains root or administrator privileges, they can alter the baseline or silence alerts. HA-FIM isolates the comparison engine and trusted fingerprints inside a hardware TEE. Even a fully compromised host OS kernel cannot tamper with the reference fingerprints or forge the enclave's signed receipts.

---

## 2. Deploying on Linux Cloud Environments (AWS Nitro Enclaves)

### 2.1 Supported EC2 Instance Families
AWS Nitro Enclaves requires an EC2 instance built on the AWS Nitro System with enclave support enabled (e.g., `c5.xlarge`, `c6i.xlarge`, `m5.xlarge`, `m6i.xlarge`, `r5.xlarge`).

### 2.2 Launching the EC2 Host Instance
Launch an EC2 instance with Nitro Enclaves enabled:
```bash
aws ec2 run-instances \
    --image-id ami-0c7217cdde317cfec \
    --instance-type c6i.xlarge \
    --key-name my-key-pair \
    --enclave-options '{"Enabled":true}' \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=hafim-nitro-host}]'
```

### 2.3 Installing Nitro CLI and Prerequisites
On the Linux EC2 host:
```bash
sudo yum install -y aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel
sudo usermod -aG ne $USER
sudo usermod -aG docker $USER
sudo systemctl enable --now nitro-enclaves-allocator.service
sudo systemctl enable --now docker
```

Configure enclave memory and CPU in `/etc/nitro_enclaves/allocator.yaml`:
```yaml
memory_mib: 1024
cpu_count: 2
```

### 2.4 Building and Launching the Enclave Image File (EIF)
```bash
# Build Docker image for the enclave
docker build -t hafim-enclave -f tee/nitro-enclaves/Dockerfile.nitro .

# Convert Docker image to Nitro Enclave Image (.eif)
nitro-cli build-enclave \
    --docker-uri hafim-enclave:latest \
    --output-file hafim-enclave.eif

# Run enclave in background
nitro-cli run-enclave \
    --eif-path hafim-enclave.eif \
    --cpu-count 2 \
    --memory-mib 1024 \
    --enclave-cid 16
```

---

## 3. Deploying on Windows Cloud Environments

### 3.1 Supported Windows Platforms
- **AWS EC2**: Windows Server 2022 / 2025 Datacenter
- **Microsoft Azure**: Azure Confidential VMs (DCasv5 / ECasv5 series with AMD SEV-SNP)
- **On-Premise**: Windows 10, Windows 11, Windows Server 2019+

### 3.2 Automated PowerShell Deployment
1. Connect to your Windows cloud instance via RDP, PowerShell Remoting, or AWS Systems Manager Session Manager.
2. Clone or copy the repository to `C:\apps\ebony`.
3. Open an administrative PowerShell prompt:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope Process
cd C:\apps\ebony\deployment\windows
.\deploy-windows.ps1 -DatabaseUrl "postgresql://user:pass@host:5432/hafim_db" -Port 8000
```

### 3.3 Quick Launch via Batch Script
For manual interactive operation:
```cmd
cd C:\apps\ebony\deployment\windows
run-windows.bat
```

### 3.4 Running as a Windows Background Service
To run HA-FIM continuously in the background on Windows Server using NSSM (Non-Sucking Service Manager) or Windows Scheduled Tasks:
```powershell
# Using NSSM to register HA-FIM backend as a permanent Windows Service:
nssm install HAFIM-Backend "C:\apps\ebony\venv-win\Scripts\python.exe" "-m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"
nssm set HAFIM-Backend AppDirectory "C:\apps\ebony"
nssm set HAFIM-Backend AppEnvironmentExtra "PYTHONPATH=C:\apps\ebony"
nssm start HAFIM-Backend
```

---

## 4. Cloud Database Configuration (PostgreSQL / Neon / RDS)

HA-FIM uses SQLAlchemy with support for both high-performance PostgreSQL (production) and SQLite (zero-config local dev).

### 4.1 Configuring Managed PostgreSQL (Neon / AWS RDS / Azure Database)
In your `.env` file:
```ini
# Production PostgreSQL (e.g. Neon Serverless Postgres or AWS RDS)
DATABASE_URL="postgresql://neondb_owner:password@ep-sample-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Local SQLite (Development & Testing)
# DATABASE_URL="sqlite:///./hafim.db"
```

The database tables, indices, foreign keys, and administrative records are created automatically on service boot.

---

## 5. Multi-Node Architecture: Enrolling Windows & Linux Agents

When running across hybrid environments:
1. Deploy the central HA-FIM Control Plane & TEE Enclave on an AWS Nitro or Azure Confidential instance.
2. Distribute the lightweight Host Agent (`agent/src/agent.py`) to individual Windows and Linux endpoints.
3. Endpoints securely stream observed fingerprints to the central enclave API for real-time validation and alerting.
