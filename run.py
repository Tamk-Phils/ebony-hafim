#!/usr/bin/env python3
"""
HA-FIM: Hardware-Assisted File Integrity Monitoring
Unified Single-Command System Starter

Starts the entire HA-FIM stack (FastAPI Backend, Host Monitoring Agent,
TEE Comparison Engine, and React Security Dashboard) with one single command.

Usage:
    python run.py             # Start unified production-mode stack (http://localhost:8000)
    python run.py --dev       # Start developer mode with hot reload & Vite dev server
    python run.py --port 8080 # Customize HTTP port
"""

import os
import sys
import argparse
import subprocess
import shutil
import platform
import socket
import signal
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

def log(msg: str, level: str = "INFO"):
    colors = {
        "INFO": "\033[94m",
        "SUCCESS": "\033[92m",
        "WARN": "\033[93m",
        "ERROR": "\033[91m",
        "RESET": "\033[0m"
    }
    if sys.platform == "win32":
        print(f"[{level}] {msg}")
    else:
        c = colors.get(level, colors["INFO"])
        r = colors["RESET"]
        print(f"{c}[{level}]{r} {msg}")

def ensure_environment():
    """Validates and prepares required directories and configuration."""
    # 1. Check/create .env
    env_file = ROOT_DIR / ".env"
    example_env = ROOT_DIR / ".env.example"
    if not env_file.exists() and example_env.exists():
        log("No .env found. Initializing from .env.example...", "WARN")
        shutil.copy(str(example_env), str(env_file))

    # 2. Check/create sandboxes
    sandbox = ROOT_DIR / "sandbox"
    test_sandbox = ROOT_DIR / "test_sandbox"
    sandbox.mkdir(exist_ok=True)
    test_sandbox.mkdir(exist_ok=True)

    auth_sample = sandbox / "system_auth.conf"
    if not auth_sample.exists():
        auth_sample.write_text(
            "# Authorized HA-FIM Monitored System Auth Configuration\n"
            "AUTH_POLICY=STRICT_TEE_VERIFIED\n"
        )

def check_or_build_frontend():
    """Ensures compiled frontend distribution exists, or triggers build."""
    dist_index = ROOT_DIR / "frontend" / "dist" / "index.html"
    if dist_index.exists():
        return True

    log("Compiled frontend not found. Building dashboard...", "INFO")
    npm_cmd = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm_cmd:
        log("npm not found on PATH. Frontend will need to be built manually or run with --dev.", "WARN")
        return False

    try:
        frontend_dir = ROOT_DIR / "frontend"
        subprocess.run([npm_cmd, "run", "build"], cwd=str(frontend_dir), check=True)
        log("Frontend build completed successfully.", "SUCCESS")
        return True
    except Exception as e:
        log(f"Automatic frontend build failed: {e}", "ERROR")
        return False

def run_dev_mode(host: str, port: int):
    """Spawns both backend and Vite frontend dev server with hot reload."""
    log("Starting HA-FIM in DEVELOPER MODE with hot reload...", "INFO")
    processes = []

    npm_cmd = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm_cmd:
        log("npm is required for --dev mode.", "ERROR")
        sys.exit(1)

    # 1. Spawn FastAPI uvicorn
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT_DIR)

    backend_cmd = [
        sys.executable, "-m", "uvicorn",
        "backend.app.main:app",
        "--host", host,
        "--port", str(port),
        "--reload"
    ]
    p_backend = subprocess.Popen(backend_cmd, cwd=str(ROOT_DIR), env=env)
    processes.append(p_backend)

    # 2. Spawn Vite dev server
    frontend_dir = ROOT_DIR / "frontend"
    p_frontend = subprocess.Popen([npm_cmd, "run", "dev"], cwd=str(frontend_dir))
    processes.append(p_frontend)

    print("\n" + "=" * 68)
    print("  HA-FIM DUAL DEV MODE ACTIVE")
    print(f"  * Backend API & Enclave: http://{host}:{port}")
    print(f"  * Interactive API Docs:  http://{host}:{port}/docs")
    print("  * Vite Frontend Server:  http://localhost:5173")
    print("  * Press Ctrl+C to terminate both servers")
    print("=" * 68 + "\n")

    def handle_sigint(sig, frame):
        print("\n[INFO] Gracefully shutting down developer processes...")
        for p in processes:
            try:
                p.terminate()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_sigint)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_sigint)

    for p in processes:
        p.wait()

def run_unified_mode(host: str, port: int, reload: bool = False):
    """Starts the unified standalone system where FastAPI serves Dashboard, API, WebSockets, and TEE."""
    check_or_build_frontend()

    # Ensure repository root is on PYTHONPATH
    if str(ROOT_DIR) not in sys.path:
        sys.path.insert(0, str(ROOT_DIR))
    os.environ["PYTHONPATH"] = str(ROOT_DIR)

    import uvicorn
    from agent.src.agent import HostMonitoringAgent

    telemetry = HostMonitoringAgent.get_system_telemetry()
    hostname = telemetry.get("hostname", socket.gethostname())
    platform_info = telemetry.get("os_platform", platform.platform())
    backend_engine = telemetry.get("monitoring_backend", "inotify / Win32")

    banner = f"""
======================================================================
  HA-FIM: Hardware-Assisted File Integrity Monitoring
  Operational Security Control Plane & TEE Enclave Engine
======================================================================
  * Web Dashboard:      http://{ 'localhost' if host in ('0.0.0.0', '127.0.0.1') else host }:{port}
  * Interactive Docs:   http://{ 'localhost' if host in ('0.0.0.0', '127.0.0.1') else host }:{port}/docs
  * Live Event Stream:  ws://{ 'localhost' if host in ('0.0.0.0', '127.0.0.1') else host }:{port}/ws/events
  * Host Endpoint:      {hostname} ({platform_info})
  * Monitoring Engine:  {backend_engine}
  * Press Ctrl+C to stop
======================================================================
"""
    print(banner)

    uvicorn.run(
        "backend.app.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )

def main():
    parser = argparse.ArgumentParser(
        description="Unified starter for the HA-FIM file integrity monitoring system."
    )
    parser.add_argument(
        "--dev", action="store_true",
        help="Run developer mode (spawns both Vite frontend and FastAPI backend with live reload)"
    )
    parser.add_argument(
        "--reload", action="store_true",
        help="Enable auto-reload on backend Python changes"
    )
    parser.add_argument(
        "--host", type=str, default="0.0.0.0",
        help="Network interface to bind (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port", type=int, default=8000,
        help="Port to listen on (default: 8000)"
    )

    args = parser.parse_args()

    ensure_environment()

    if args.dev:
        run_dev_mode(args.host, args.port)
    else:
        run_unified_mode(args.host, args.port, reload=args.reload)

if __name__ == "__main__":
    main()
