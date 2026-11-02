#!/usr/bin/env bash
# Script to build and run the HA-FIM Nitro Enclave Image File (EIF)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENCLAVE_DIR="$PROJECT_ROOT/tee/nitro-enclaves"
EIF_OUTPUT="$PROJECT_ROOT/deployment/aws/hafim_enclave.eif"

echo "[*] Building Enclave Docker container image..."
docker build -t hafim-nitro-image:latest -f "$ENCLAVE_DIR/Dockerfile.nitro" "$ENCLAVE_DIR"

echo "[*] Converting Docker image to Nitro Enclave Image File (EIF)..."
nitro-cli build-enclave \
    --docker-uri hafim-nitro-image:latest \
    --output-file "$EIF_OUTPUT"

echo "[*] Extracting Enclave PCR Measurements:"
nitro-cli describe-eif --eif-path "$EIF_OUTPUT"

echo "[*] Launching Enclave (CID 16, 2 vCPUs, 1024 MB RAM)..."
nitro-cli run-enclave \
    --eif-path "$EIF_OUTPUT" \
    --cpu-count 2 \
    --memory 1024 \
    --enclave-cid 16 \
    --debug-mode

echo "[+] HA-FIM Nitro Enclave is running! Verifying with 'nitro-cli describe-enclaves'..."
nitro-cli describe-enclaves
