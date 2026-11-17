# ==============================================================================
# HA-FIM: Hardware-Assisted File Integrity Monitoring
# Windows Cloud & Server Deployment Script (PowerShell 5.1+)
# ==============================================================================
<#
.SYNOPSIS
    Deploys and initializes the HA-FIM backend and agent on Windows Server / Windows 10/11.

.DESCRIPTION
    1. Validates Python 3.10+ installation.
    2. Provisions a dedicated virtual environment.
    3. Installs backend dependencies.
    4. Initializes .env configuration with Windows-normalized paths.
    5. Sets up the default sandbox and database.
    6. Starts the HA-FIM FastAPI service and Host Monitoring Agent.

.PARAMETER DatabaseUrl
    Optional PostgreSQL or SQLite connection string. Default: sqlite:///./hafim.db

.PARAMETER Port
    HTTP Port for HA-FIM API control plane. Default: 8000

.EXAMPLE
    .\deploy-windows.ps1
    .\deploy-windows.ps1 -DatabaseUrl "postgresql://user:pass@host:5432/hafim_db" -Port 8080
#>

param(
    [string]$DatabaseUrl = "sqlite:///./hafim.db",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  HA-FIM: Hardware-Assisted File Integrity Monitoring     " -ForegroundColor White
Write-Host "  Windows Server & Cloud Endpoint Deployment Manager      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Python
Write-Host "[1/6] Detecting Python environment..." -ForegroundColor Yellow
$PythonCmd = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $PythonCmd) {
    $PythonCmd = (Get-Command py -ErrorAction SilentlyContinue)
}
if (-not $PythonCmd) {
    Write-Error "Python 3.10+ was not found on PATH. Please install Python from https://www.python.org/downloads/windows/ and check 'Add python.exe to PATH'."
    exit 1
}

$PyVersion = & $PythonCmd.Source --version
Write-Host "  Found: $PyVersion at $($PythonCmd.Source)" -ForegroundColor Green

# 2. Virtual Environment Setup
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
Set-Location $ProjectRoot

$VenvDir = Join-Path $ProjectRoot "venv-win"
if (-not (Test-Path $VenvDir)) {
    Write-Host "[2/6] Creating Python virtual environment at $VenvDir..." -ForegroundColor Yellow
    & $PythonCmd.Source -m venv $VenvDir
} else {
    Write-Host "[2/6] Virtual environment already present at $VenvDir" -ForegroundColor Green
}

$VenvPy = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip = Join-Path $VenvDir "Scripts\pip.exe"

# 3. Install Dependencies
Write-Host "[3/6] Installing Python dependencies..." -ForegroundColor Yellow
& $VenvPip install --upgrade pip setuptools wheel --quiet
$ReqFile = Join-Path $ProjectRoot "backend\requirements.txt"
& $VenvPip install -r $ReqFile --quiet
Write-Host "  Dependencies successfully installed." -ForegroundColor Green

# 4. Configure .env for Windows
Write-Host "[4/6] Verifying environment configuration..." -ForegroundColor Yellow
$EnvFile = Join-Path $ProjectRoot ".env"
$SandboxDir = Join-Path $ProjectRoot "sandbox"
$TestSandboxDir = Join-Path $ProjectRoot "test_sandbox"

New-Item -ItemType Directory -Force -Path $SandboxDir | Out-Null
New-Item -ItemType Directory -Force -Path $TestSandboxDir | Out-Null

$SampleFile = Join-Path $SandboxDir "system_auth.conf"
if (-not (Test-Path $SampleFile)) {
    Set-Content -Path $SampleFile -Value "# Authorized HA-FIM Monitored System Auth Configuration`r`nAUTH_POLICY=STRICT_TEE_VERIFIED`r`n"
}

if (-not (Test-Path $EnvFile)) {
    $EnvContent = @"
PROJECT_NAME="HA-FIM (Hardware-Assisted File Integrity Monitoring)"
VERSION="1.0.0"
SECRET_KEY="windows_enterprise_hafim_secret_key_minimum_32_chars"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=720
DATABASE_URL="$DatabaseUrl"
TEE_MODE="DEVELOPMENT_SOFTWARE_ONLY"
RECONCILIATION_INTERVAL_SECONDS=15
AGENT_HEARTBEAT_TIMEOUT_SECONDS=30
MAX_FILE_SIZE_BYTES=104857600
"@
    Set-Content -Path $EnvFile -Value $EnvContent
    Write-Host "  Generated new .env for Windows environment." -ForegroundColor Green
} else {
    Write-Host "  Using existing .env configuration." -ForegroundColor Green
}

# 5. Database Schema Initialization & Admin Provisioning
Write-Host "[5/6] Initializing database tables and admin security baseline..." -ForegroundColor Yellow
$InitScript = @"
import os, sys
sys.path.insert(0, r'$ProjectRoot')
from backend.app.database.session import Base, engine, SessionLocal
from backend.app.models.all_models import Admin, MonitoringTarget, AgentStatusRecord
from backend.app.core.security import hash_password
import socket, platform

Base.metadata.create_all(bind=engine)
db = SessionLocal()
try:
    if db.query(Admin).count() == 0:
        admin = Admin(username='admin', hashed_password=hash_password('CyberSecResearch2026!'), is_active=True)
        db.add(admin)
        print('  Provisioned default administrator account: admin')
    
    agent = db.query(AgentStatusRecord).first()
    if not agent:
        agent = AgentStatusRecord(
            agent_id='win-agent-01',
            hostname=socket.gethostname(),
            status='ACTIVE',
            monitored_paths_count=1,
            events_generated_count=0
        )
        db.add(agent)
    else:
        agent.hostname = socket.gethostname()
        agent.status = 'ACTIVE'
    db.commit()
finally:
    db.close()
"@
& $VenvPy -c $InitScript
Write-Host "  Database initialized successfully." -ForegroundColor Green

# 6. Service Launch
Write-Host "[6/6] Starting HA-FIM Control Plane on http://0.0.0.0:$Port..." -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to terminate the service.`n" -ForegroundColor DarkGray

$env:PYTHONPATH = $ProjectRoot
& $VenvPy -m uvicorn backend.app.main:app --host 0.0.0.0 --port $Port --reload
