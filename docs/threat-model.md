# HA-FIM: Threat Model

### 1. Adversary Capabilities and Assumptions

In accordance with the research proposal *"Hardware-Assisted File Integrity Monitoring Using Trusted Execution Environments (TEEs) in Cloud Infrastructure"*, HA-FIM is engineered under an advanced threat model:

#### Assumed Attacker Capabilities:
1. **Host Privilege Escalation**: The adversary may acquire full `root` or `SYSTEM` privileges on the host OS running the monitored workloads.
2. **Filesystem Tampering**: The adversary can arbitrarily create, edit, overwrite, truncate, append, delete, or rename monitored files and manipulate inode metadata (permissions, ownership, timestamps).
3. **Host-Side Baseline Compromise**: If baseline files or hashes are located in host memory or on the host filesystem, the adversary can modify or overwrite them with malicious checksums.
4. **Agent Interference**: The adversary can pause (`SIGSTOP`), terminate (`SIGKILL`), crash, or unhook the host-side monitoring agent or inotify listeners.
5. **Notification Suppression**: An attacker operating in kernel space can suppress inotify/fanotify events or flood notification queues to induce event loss.
6. **Network / Alert Interception**: The adversary may block outbound network traffic destined for external SIEMs, syslog, or email alerts.
7. **Replay & Stale Data Attacks**: An adversary can capture previously authenticated TEE responses or baseline packets and replay them to spoof a clean system state.

#### Security Boundary Limitations (What the Attacker CANNOT Do):
1. **Breach the TEE Hardware Boundary**: The adversary cannot read or modify the encrypted physical memory of the hardware-backed enclave (e.g., AWS Nitro Enclave memory space isolated via Nitro hypervisor and dedicated CPU cores/memory allocations).
2. **Forge Hardware Remote Attestation**: The adversary cannot counterfeit an AWS Nitro Enclaves Attestation Document cryptographically signed by the AWS Nitro Enclaves Root of Trust Certificate Authority.
3. **Counterfeit In-Enclave Cryptographic Keys**: Keys generated or held exclusively inside the enclave cannot be extracted through the host operating system.

---

### 2. Threat Scenarios and Defense Mechanisms

| Threat ID | Attack Vector | Classical FIM Vulnerability | HA-FIM Hardware-Assisted Mitigation |
| :--- | :--- | :--- | :--- |
| **T-01: Unauthorized File Modification** | Attacker modifies `/etc/pam.d/common-auth` to insert a backdoor. | Host FIM detects modification if running; if root attacker kills FIM first, change is undetected. | TEE maintains authoritative baseline. Host agent and reconciliation scans submit observed hash. TEE comparison engine identifies mismatch and signs violation receipt. |
| **T-02: Baseline Tampering** | Attacker replaces `/var/lib/fim/baseline.db` with hashes matching the backdoored file. | Classical FIM now trusts the backdoor as the new baseline! | The authoritative baseline resides inside the TEE enclave memory. Host OS cannot write to TEE memory. Baseline updates require an authenticated administrative workflow signed by admin credentials. |
| **T-03: Agent Suppression / Disabling** | Attacker executes `kill -9 $(pgrep fim-agent)`. | Classical FIM ceases monitoring. No alerts generated. | Control plane monitors host agent heartbeat. If heartbeats cease past threshold (e.g., 30s), system triggers an "Agent Interruption" alert. Scheduled external reconciliation flags missed intervals. |
| **T-04: Replay of Clean State** | Attacker captures a verification receipt from when `/bin/login` was clean and resends it. | Vulnerable to stale status attacks. | TEE verification requests and responses incorporate client request IDs, monotonic sequence numbers, and enclave timestamps. Out-of-order or replayed tokens are rejected. |
| **T-05: Inotify Event Starvation** | Attacker creates thousands of temp files in rapid succession to overflow inotify queues. | Filesystem notification drop causes subsequent malicious edits to go unnoticed. | Hybrid detection: inotify event-driven triggers + deterministic periodic reconciliation sweeps across all configured roots. |
| **T-06: Malformed / Injection Requests** | Attacker sends oversized payloads or malformed JSON into the TEE communication channel. | Buffer overflows or denial of service within the comparison logic. | Strict schema enforcement, bounded maximum message sizes (e.g., 64KB), and input sanitization inside the TEE boundary. |

---

### 3. Out-of-Scope Threats

1. **Physical side-channel / cold-boot attacks** on physical cloud datacenter servers (addressed by cloud provider physical security).
2. **Compromised administrative credentials**: If the valid administrator’s master key or credentials are stolen, the attacker can legitimately approve a baseline update.
3. **Denial of Service against the Enclave**: An attacker with host root can terminate the entire Nitro Enclave instance. (HA-FIM detects this as a TEE connection failure / unreachability event).
