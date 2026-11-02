#!/usr/bin/env python3
"""
AWS Nitro Enclaves Comparison Engine Daemon
Runs strictly inside the isolated AWS Nitro Enclave memory space.
Listens on AF_VSOCK port 5000 and serves verification requests.
"""

import socket
import struct
import json
import hashlib
import hmac
import os
import sys
import time
from typing import Dict, Any

class EnclaveEngine:
    def __init__(self):
        # Ephemeral private key generated in enclave RAM on boot
        self.enclave_secret = os.urandom(32)
        self.baseline: Dict[str, Dict[str, Any]] = {}
        self.version = 0
        self.last_sequence_seen = 0
        self.total_verifications = 0
        self.total_rejections = 0

    def sign(self, payload: str) -> str:
        return hmac.new(self.enclave_secret, payload.encode("utf-8"), hashlib.sha256).hexdigest()

    def handle_request(self, req: Dict[str, Any]) -> Dict[str, Any]:
        action = req.get("action")
        params = req.get("params", {})

        if action == "ping":
            return {"status": "PONG", "enclave_time": time.time()}

        elif action == "initialize_baseline":
            files = params.get("files", [])
            admin_token = params.get("admin_token", "")
            if not admin_token:
                self.total_rejections += 1
                return {"success": False, "error": "Missing admin token in enclave init"}

            self.baseline.clear()
            self.version += 1
            for f in files:
                self.baseline[f["file_path"]] = {
                    "sha256_hash": f["sha256_hash"],
                    "size_bytes": f["size_bytes"],
                    "permissions": f["permissions"]
                }
            sig = self.sign(f"NITRO_INIT:v{self.version}:files={len(files)}")
            return {
                "success": True,
                "version": self.version,
                "total_files": len(self.baseline),
                "signature": sig
            }

        elif action == "verify_file":
            file_path = params.get("file_path")
            observed_hash = params.get("observed_hash")
            permissions = params.get("permissions")
            sequence_no = params.get("sequence_no", 0)

            # Anti-replay check
            if sequence_no <= self.last_sequence_seen:
                self.total_rejections += 1
                return {
                    "verdict": "REPLAY_DETECTED",
                    "error": f"Replay detected: seq {sequence_no} <= last seen {self.last_sequence_seen}",
                    "timestamp": time.time()
                }
            self.last_sequence_seen = sequence_no
            self.total_verifications += 1

            expected = self.baseline.get(file_path)
            if observed_hash is None:
                verdict = "DELETED" if expected else "UNTRACKED_DELETED"
                exp_hash = expected["sha256_hash"] if expected else None
                exp_perm = expected["permissions"] if expected else None
            elif expected is None:
                verdict = "NEW"
                exp_hash = None
                exp_perm = None
            elif expected["sha256_hash"].lower() != observed_hash.lower():
                verdict = "TAMPERED"
                exp_hash = expected["sha256_hash"]
                exp_perm = expected["permissions"]
            elif expected["permissions"] != permissions:
                verdict = "PERMISSION_CHANGED"
                exp_hash = expected["sha256_hash"]
                exp_perm = expected["permissions"]
            else:
                verdict = "MATCH"
                exp_hash = expected["sha256_hash"]
                exp_perm = expected["permissions"]

            receipt_sig = self.sign(f"NITRO_VERIFY:{verdict}:{file_path}:{exp_hash}:{observed_hash}:{sequence_no}")
            return {
                "verdict": verdict,
                "expected_hash": exp_hash,
                "expected_permissions": exp_perm,
                "timestamp": time.time(),
                "receipt_signature": receipt_sig
            }

        elif action == "approve_baseline_update":
            file_path = params.get("file_path")
            new_hash = params.get("new_hash")
            admin_token = params.get("admin_token")
            sequence_no = params.get("sequence_no", 0)

            if not admin_token:
                self.total_rejections += 1
                return {"success": False, "error": "Missing admin authorization token"}

            if sequence_no <= self.last_sequence_seen:
                self.total_rejections += 1
                return {"success": False, "error": "Replay attack detected during update"}
            self.last_sequence_seen = sequence_no

            old_entry = self.baseline.get(file_path)
            old_hash = old_entry["sha256_hash"] if old_entry else None
            self.baseline[file_path] = {
                "sha256_hash": new_hash,
                "size_bytes": params.get("size_bytes", 0),
                "permissions": params.get("permissions", "0644")
            }
            self.version += 1
            sig = self.sign(f"NITRO_UPDATE:{file_path}:{old_hash}->{new_hash}:v{self.version}")
            return {
                "success": True,
                "old_hash": old_hash,
                "version": self.version,
                "receipt_signature": sig
            }

        elif action == "get_baseline_status":
            return {
                "status": "OPERATIONAL",
                "version": self.version,
                "total_files": len(self.baseline),
                "last_sequence": self.last_sequence_seen
            }

        elif action == "get_attestation":
            nonce = params.get("nonce", "")
            # If running on AWS Nitro with /dev/nsm, ioctl would query NSM device.
            # In simulation/demonstration inside Nitro:
            return {
                "attestation_doc": {
                    "module_id": "hafim-nitro-enclave-01",
                    "digest": "SHA-384",
                    "timestamp": int(time.time()),
                    "PCR0": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                    "PCR1": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                    "PCR2": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
                    "nonce": nonce
                }
            }

        return {"error": f"Unknown action: {action}"}

def run_server(port: int = 5000):
    if not hasattr(socket, "AF_VSOCK"):
        print("AF_VSOCK is not supported in this environment.", file=sys.stderr)
        sys.exit(1)

    engine = EnclaveEngine()
    server_sock = socket.socket(socket.AF_VSOCK, socket.SOCK_STREAM)
    # VMADDR_CID_ANY = -1 or 0xFFFFFFFF
    cid_any = getattr(socket, "VMADDR_CID_ANY", -1)
    server_sock.bind((cid_any, port))
    server_sock.listen(5)
    print(f"HA-FIM Nitro Enclave Comparison Engine listening on vsock port {port}...")

    while True:
        client_sock, addr = server_sock.accept()
        try:
            raw_len = client_sock.recv(4)
            if not raw_len or len(raw_len) < 4:
                continue
            msg_len = struct.unpack("!I", raw_len)[0]
            data = client_sock.recv(msg_len)
            req = json.loads(data.decode("utf-8"))
            resp = engine.handle_request(req)
            resp_bytes = json.dumps(resp).encode("utf-8")
            client_sock.sendall(struct.pack("!I", len(resp_bytes)) + resp_bytes)
        except Exception as e:
            print(f"Error handling request: {e}", file=sys.stderr)
        finally:
            client_sock.close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    run_server(port)
