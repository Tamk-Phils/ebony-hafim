# HA-FIM: Architectural Limitations and Security Boundaries

In cybersecurity academic research, honesty about threat models and technical limitations is paramount. This document delineates the fundamental boundaries of Hardware-Assisted File Integrity Monitoring using Trusted Execution Environments.

---

### 1. The "Trusted File Content" Problem (Host I/O Dilemma)

#### The Problem
A Trusted Execution Environment (such as an AWS Nitro Enclave, Intel SGX, or AMD SEV VM) does not possess direct, unmediated hardware DMA access to the host virtual filesystem. Files stored on the host's ext4/XFS filesystem reside outside the enclave's encrypted physical memory.

To verify a file, the host monitoring agent (or a host kernel driver) must:
1. Open the file on the host filesystem (`open()`).
2. Read the file blocks into host memory (`read()`).
3. Compute the SHA-256 hash or transmit the raw blocks across `AF_VSOCK` into the enclave.

#### The Limitation
If an attacker has achieved **ring-0 kernel compromise** on the host OS:
- The compromised kernel can hook the VFS layer (`sys_read`) or page cache.
- When the FIM agent reads `/bin/login`, the rootkit can return clean, unmodified blocks while serving trojaned blocks to other processes.
- Consequently, the host agent transmits the *spoofed* clean blocks to the TEE. The TEE comparison engine correctly verifies the hash of what it was given, but what it was given was a lie.

#### HA-FIM Stance and Documentation
- **HA-FIM does NOT claim that a TEE can independently observe the physical host disk in defiance of a compromised kernel.**
- **What HA-FIM DOES achieve**:
  1. **Tamper-Proof Baseline**: In classical FIM, an attacker who obtains host root simply edits `/var/lib/ossec/queue/fts/` or `/etc/aide/aide.db.gz`. With HA-FIM, the authoritative baseline is sealed inside the TEE; root cannot alter expected hashes.
  2. **Tamper-Proof Logic**: Root cannot patch the comparison binary in memory to force `verify() -> TRUE`.
  3. **Attested Verification Receipts**: Every verification decision is signed by the enclave with monotonic sequence numbers, preventing forged clean receipts.
  4. **Detection of Host Interference**: Out-of-band heartbeats, reconciliation intervals, and unexpected baseline sync requests expose host agent tampering.

---

### 2. Time-of-Check to Time-of-Use (TOCTOU) Races

A race condition exists between the moment the host agent computes the SHA-256 digest of a file and the moment another process executes or modifies the file. Atomic snapshotting (e.g., LVM/btrfs snapshots or ioctl freezing) can reduce this window, but cannot entirely eliminate concurrent kernel-level modifications.

---

### 3. Out-of-Band Alerting and Denial of Service

If the host operating system is completely compromised, an attacker can:
1. Block all network egress to SIEMs or alerting endpoints.
2. Terminate the AWS Nitro Enclave entirely (`nitro-cli terminate-enclave`).

**HA-FIM Mitigation**:
HA-FIM designs the management plane with **Dead Man's Snitch / Liveness Monitoring**. External SIEM or dashboard collectors expect periodic cryptographically signed heartbeats from the TEE via an independent out-of-band channel. If heartbeats cease, an alert is raised externally: *"Host agent or Enclave is unresponsive / potentially compromised."*
