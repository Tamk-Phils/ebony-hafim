# ==============================================================================
# HA-FIM: Hardware-Assisted File Integrity Monitoring
# Single-Command System Starter (Windows PowerShell)
# ==============================================================================
param(
    [switch]$Dev,
    [switch]$Reload,
    [int]$Port = 8000,
    [string]$Host = "0.0.0.0"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

$PythonExe = "python"
if (Test-Path "$ScriptDir\venv\Scripts\python.exe") {
    $PythonExe = "$ScriptDir\venv\Scripts\python.exe"
} elseif (Test-Path "$ScriptDir\venv-win\Scripts\python.exe") {
    $PythonExe = "$ScriptDir\venv-win\Scripts\python.exe"
} elseif (Test-Path "$ScriptDir\.venv\Scripts\python.exe") {
    $PythonExe = "$ScriptDir\.venv\Scripts\python.exe"
}

$Arguments = @("$ScriptDir\run.py", "--host", $Host, "--port", $Port)
if ($Dev) { $Arguments += "--dev" }
if ($Reload) { $Arguments += "--reload" }

& $PythonExe @Arguments
