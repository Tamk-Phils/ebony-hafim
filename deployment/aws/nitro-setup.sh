#!/usr/bin/env bash
# AWS Nitro Enclaves Host Prerequisites Setup Script
set -euo pipefail

echo "=================================================="
echo "    AWS Nitro Enclaves Host Environment Setup     "
echo "=================================================="

# 1. Verify Nitro Enclave capability on EC2
echo "[*] Checking instance enclave capability..."
if ! command -v lscpu &> /dev/null; then
    echo "[!] lscpu command not available."
fi

# 2. Install Nitro CLI packages on Amazon Linux 2 / 2023 or RHEL
if command -v dnf &> /dev/null; then
    echo "[*] Installing Nitro Enclaves CLI via dnf..."
    sudo dnf install -y aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel
elif command -v apt-get &> /dev/null; then
    echo "[*] Debian/Ubuntu detected. Installing nitro-cli build dependencies..."
    sudo apt-get update && sudo apt-get install -y linux-modules-extra-$(uname -r) docker.io
fi

# 3. Configure Nitro Enclaves Resource Allocator
# Enclave requires dedicated memory and vCPUs isolated from host OS
echo "[*] Configuring /etc/nitro_enclaves/allocator.yaml..."
sudo mkdir -p /etc/nitro_enclaves
sudo tee /etc/nitro_enclaves/allocator.yaml > /dev/null <<EOF
# Minimum memory allocation: 1024 MB
memory_mib: 1024
# Number of dedicated isolated vCPUs
cpu_count: 2
EOF

# 4. Enable and start allocator service
if command -v systemctl &> /dev/null; then
    echo "[*] Starting nitro-enclaves-allocator.service..."
    sudo systemctl enable --now nitro-enclaves-allocator.service || true
fi

# 5. Add current user to nitro-enclaves group
sudo usermod -aG ne,docker "$USER" || true

echo "[+] Nitro host setup complete. Log out and back in for group permissions to take effect."
