#!/usr/bin/env bash
# ==============================================================================
# HA-FIM: Hardware-Assisted File Integrity Monitoring
# Single-Command System Starter (Linux / macOS)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$SCRIPT_DIR"

# 1. Detect or initialize Python virtual environment
if [ -f "$SCRIPT_DIR/venv/bin/python" ]; then
    PYTHON="$SCRIPT_DIR/venv/bin/python"
elif [ -f "$SCRIPT_DIR/.venv/bin/python" ]; then
    PYTHON="$SCRIPT_DIR/.venv/bin/python"
elif command -v python3 &>/dev/null; then
    PYTHON="python3"
elif command -v python &>/dev/null; then
    PYTHON="python"
else
    echo "[ERROR] Python 3.10+ was not found on PATH." >&2
    exit 1
fi

# 2. Forward all arguments directly to run.py
exec "$PYTHON" "$SCRIPT_DIR/run.py" "$@"
