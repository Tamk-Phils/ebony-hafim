@echo off
REM ==============================================================================
REM HA-FIM: Hardware-Assisted File Integrity Monitoring
REM Windows Quick Launch Batch Script
REM ==============================================================================

setlocal enabledelayedexpansion

echo ==========================================================
echo   HA-FIM: Hardware-Assisted File Integrity Monitoring
echo   Windows Rapid Starter
echo ==========================================================

cd /d "%~dp0..\.."

if exist "venv-win\Scripts\python.exe" (
    set "PYTHON_EXE=venv-win\Scripts\python.exe"
) else if exist "venv\Scripts\python.exe" (
    set "PYTHON_EXE=venv\Scripts\python.exe"
) else (
    echo [INFO] Virtual environment not found. Checking system Python...
    where python >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Python not found. Please install Python 3.10+ or run deploy-windows.ps1
        pause
        exit /b 1
    )
    set "PYTHON_EXE=python"
)

set PYTHONPATH=%CD%
echo [INFO] Launching HA-FIM backend on http://localhost:8000 ...
"%PYTHON_EXE%" -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
pause
