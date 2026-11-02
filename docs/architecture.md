# HA-FIM: Hardware-Assisted File Integrity Monitoring
## System Architecture Specification

### 1. Overview and Motivation

Traditional File Integrity Monitoring (FIM) systems execute entirely within the host operating system. Consequently, if an adversary gains administrative (root/SYSTEM) privileges or compromises the kernel/hypervisor, they can:
1. Modify critical binary, configuration, or system files.
2. Alter or overwrite the trusted baseline database stored on the host filesystem.
3. Terminate, suspend, or inject malicious code into the host monitoring agent.
4. Tamper with or suppress outbound security alerts.

**HA-FIM (Hardware-Assisted File Integrity Monitoring)** mitigates this fundamental vulnerability by decomposing the monitoring architecture and isolating the security-critical comparison engine and authoritative baseline state inside a **Trusted Execution Environment (TEE)**—specifically targeting **AWS Nitro Enclaves** in cloud environments, with modular abstraction for confidential computing platforms.

---

### 2. Logical Components

```
+-----------------------------------------------------------------------------------+
| HOST ENVIRONMENT (Untrusted / Potentially Compromised)                            |
|                                                                                   |
|  +---------------------------+             +-----------------------------------+  |
|  |   Monitored Filesystem    |             |  FastAPI Backend & Control Plane  |  |
|  |  (Configured Roots only)  |             |  - SQLite / PostgreSQL Metadata   |  |
|  +-------------+-------------+             |  - REST API & WebSocket Server    |  |
|                |                           |  - RBAC Admin Authentication      |  |
|                v                           +-----------------+-----------------+  |
|  +---------------------------+                               ^                    |
|  |   Host Monitoring Agent   |                               | Authenticated REST |
|  |  - Inotify Watcher (Linux)|                               | & WebSocket alerts |
|  |  - Periodic Reconciliation|                               v                    |
|  |  - SHA-256 Content Hasher |             +-----------------+-----------------+  |
|  |  - Rate-Limited Queue     |             |    Web Dashboard (React / TS)     |  |
|  +-------------+-------------+             |    - 8 Security Operations Pages  |  |
|                |                           +-----------------------------------+  |
+----------------|------------------------------------------------------------------+
                 |
                 | Host-to-TEE Communication Interface
                 | (AF_VSOCK: Enclave CID + Port / Local Unix Domain Socket Adapter)
                 |
+----------------v------------------------------------------------------------------+
| TRUSTED EXECUTION ENVIRONMENT (TEE) BOUNDARY                                      |
| AWS Nitro Enclave / Hardware-Isolated Enclave Memory                              |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                     TEE-Resident Comparison Engine                          |  |
|  |                                                                             |  |
|  |  [Strict Protocol Parser]  --> Request Validation & Anti-Replay Counter     |  |
|  |                                                                             |  |
|  |  [Authoritative Baseline]  --> Tamper-Proof In-Enclave Storage             |  |
|  |                                - Expected SHA-256 Hashes                    |  |
|  |                                - File Metadata (Size, Permissions, Mtime)   |  |
|  |                                - Baseline Version & Monotonic Sequence      |  |
|  |                                                                             |  |
|  |  [Cryptographic Engine]   --> Constant-Time Hash Comparison                |  |
|  |                                - HMAC-SHA256 Token Signing                  |  |
|  |                                - Nitro Attestation Document Generator       |  |
|  |                                                                             |  |
|  |  [Administrative Guard]   --> Rejects Unauthorized Baseline Modifications  |  |
|  |                                - Requires Administrator Signature/Auth      |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

#### Component A: Host Monitoring Agent
- **Responsibilities**:
  - Watches explicitly configured root directories using Linux filesystem event notifications (`inotify`).
  - Executes periodic background reconciliation sweeps to detect changes missed by dropped or coalesced event notifications.
  - Reads observed file contents in bounded chunks and computes SHA-256 digests.
  - Submits structured verification requests across the Host-to-TEE communication interface.
  - Forwards authenticated verification receipts and integrity event telemetry to the backend service.
  - Emits periodic heartbeat pings to detect agent interruption or suppression.

#### Component B: TEE-Resident Comparison Engine
- **Responsibilities**:
  - Encapsulated within the isolated TEE address space (zero external network interfaces, persistent storage access, or interactive shells).
  - Validates request format, payload length, and monotonic sequence numbers (anti-replay).
  - Maintains the authoritative baseline in protected enclave memory.
  - Evaluates observed hashes and metadata against expected records.
  - Generates cryptographically signed verification receipts containing the verification verdict, timestamp, sequence number, and HMAC-SHA256 signature.
  - Enforces strict administrative authorization for baseline initialization and updates.

#### Component C: Baseline Management Service
- **Responsibilities**:
  - Coordinates initial baseline generation across authorized target directories.
  - Tracks versioned baseline snapshots with monotonic version integers.
  - Manages the baseline change approval workflow (admin review, explicit hash approval, TEE baseline synchronization).
  - Prevents accidental or hostile baseline replacement.

#### Component D: Host-to-TEE Communication Interface
- **Mechanism**:
  - AWS Nitro Enclaves: Communication utilizes the virtual socket (`AF_VSOCK`) family between the host EC2 instance (CID 3) and the Enclave (CID assigned by Nitro CLI, e.g., CID 16).
  - Local Development Mode: Emulates the vsock communication channel using strict Loopback/Unix Domain Sockets or in-process decoupled adapters with identical serialization, schema validation, and error semantics.
  - Protocol: Length-prefixed JSON-RPC / Protobuf-style binary frames with request ID, client timestamp, monotonic counter, and cryptographic signature.

#### Component E: Alerting and Reporting Service
- **Responsibilities**:
  - Persists all integrity violations, baseline changes, agent heartbeats, and attestation audits to a structured relational database.
  - Categorizes events into distinct severities: `CRITICAL` (tampered file content, unauthorized baseline modification attempt, attestation failure), `HIGH` (unexpected file creation/deletion, permission change), `MEDIUM` (reconciliation discrepancy), `LOW` (agent heartbeat).
  - Streams real-time alerts to the administrative dashboard via WebSockets.
  - Provides query filters and CSV export for digital forensics and academic evaluation.

---

### 3. Trust Boundary Definition

| Boundary | Components Involved | Trust Level | Defense Mechanism |
| :--- | :--- | :--- | :--- |
| **TEE Boundary** | TEE Comparison Engine vs. Host OS | TEE is Trusted; Host OS is Untrusted | Hardware memory encryption, CPU-isolated execution, no persistent host storage access |
| **VSOCK Interface** | Host Agent vs. TEE Service | Narrow, Untrusted Channel | Strict input validation, size limits, anti-replay monotonic counters, authenticated tokens |
| **Control Plane** | Frontend Admin vs. FastAPI Backend | Authenticated & Audited | PBKDF2/Argon2 password hashing, JWT Bearer tokens, CSRF protection, Audit logging |
| **Filesystem Interface**| Monitored Files vs. Host Agent | Host OS is Untrusted | Baseline cannot be modified by host agent; periodic scans counter dropped inotify events |
