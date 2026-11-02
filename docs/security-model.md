# HA-FIM: Security Model & Attestation Protocol

### 1. Cryptographic Principles

HA-FIM employs cryptographic mechanisms at every tier:
1. **File Content Hashing**: Uses standard SHA-256 (FIPS 180-4) computed in streaming 64KB blocks.
2. **Verification Receipts**: The TEE comparison engine signs each verification verdict using an HMAC-SHA256 secret or an Enclave Ed25519/RSA private key generated inside enclave memory at startup.
3. **Anti-Replay Sequences**: Each verification request must increment a monotonic counter. The TEE validates:
   $$\text{req.sequence} > \text{enclave.last\_seen\_sequence}$$
   Any request with a sequence number less than or equal to the last recorded sequence is rejected immediately with an `ERR_REPLAY_DETECTED` code.
4. **Administrative Baseline Signatures**: Baseline initialization and update actions require an authenticated administrative JWT or cryptographic signature from an approved operator.

---

### 2. TEE Remote Attestation Protocol (AWS Nitro Enclaves)

In a genuine AWS Nitro Enclaves deployment, the host instance cannot simply "claim" the enclave is trustworthy. The verifier (the backend control plane or remote auditor) must perform **Remote Attestation**:

```
[ Host Application ]                  [ AWS Nitro Enclave ]            [ AWS Nitro PKI ]
        |                                      |                                |
        | 1. Request Attestation (Nonce)       |                                |
        |------------------------------------->|                                |
        |                                      |                                |
        |                                      | 2. Calls NSM driver            |
        |                                      |    (/dev/nsm) with Nonce       |
        |                                      |    Returns COSE-Sign1 Document |
        |                                      |                                |
        | 3. Returns Attestation Document      |                                |
        |<-------------------------------------|                                |
        |                                                                       |
        | 4. Validate Attestation Document:                                     |
        |    a. Verify X.509 Certificate Chain up to AWS Nitro Root CA -------->|
        |    b. Verify signature over COSE payload                              |
        |    c. Verify Nonce matches fresh challenge (replay defense)           |
        |    d. Compare PCRs against known Golden Image:                        |
        |       - PCR0: Hash of the Enclave Image File (EIF) kernel/cmdline    |
        |       - PCR1: Hash of OS / Init kernel modules                        |
        |       - PCR2: Hash of Enclave Application binary                      |
        |                                                                       |
        | 5. Trust Established: Enclave is verified genuine & uncompromised!    |
```

#### Trust Policy Configuration
The backend maintains an explicit Trust Policy configuration:
```json
{
  "pki_root_ca": "AWS Nitro Enclaves Root CA",
  "expected_pcr0": "a1b2c3d4e5f6... (SHA-384 of Enclave Image)",
  "expected_pcr1": "000000000000... (Kernel measurement)",
  "expected_pcr2": "f9e8d7c6b5a4... (Application measurement)",
  "max_age_seconds": 3600
}
```

If any PCR measurement does not match the approved policy, the TEE adapter marks attestation as `REJECTED`, switches system health to `DEGRADED`, and logs a critical security alert.

---

### 3. Separation of Modes

To ensure absolute integrity and compliance with research ethics:
- **Local Development Mode (`DEVELOPMENT_SOFTWARE_ONLY`)**:
  - Employs software-based comparison in host userspace.
  - Generates synthetic receipts with a software HMAC key marked `MODE: SOFTWARE_UNENCRYPTED`.
  - Prominently displays: `"WARNING: Hardware-assisted isolation is NOT ACTIVE. Software-only emulation mode."`
  - Explicitly documents that kernel compromise can defeat this mode.
- **Hardware-Backed TEE Mode (`NITRO_ENCLAVE_HARDWARE`)**:
  - Connects strictly through `AF_VSOCK`.
  - Parses real COSE-Sign1 Attestation documents using x509 verification.
  - Rejects execution if vsock or enclave is unavailable. **Never falls back silently to software mode.**
- **Test Simulation Mode (`TEST_MOCK_ONLY`)**:
  - Deterministic harness for CI/CD test suites simulating enclave fault scenarios.
