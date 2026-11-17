@echo off
REM ==============================================================================
REM HA-FIM: Hardware-Assisted File Integrity Monitoring
REM Single-Command System Starter (Windows Command Prompt / Double-Click)
REM ==============================================================================

setlocal enabledelayedexpansion
cd /d "%~dp0"

if exist "venv\Scripts\python.exe" (
    set "PYTHON_EXE=venv\Scripts\python.exe"
) else if exist "venv-win\Scripts\python.exe" (
    set "PYTHON_EXE=venv-win\Scripts\python.exe"
) else if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXE=.venv\Scripts\python.exe"
) else (
    where python >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Python 3.10+ was not found on PATH.
        echo Please install Python from https://www.python.org/downloads/
        pause
        exit /b 1
    )
    set "PYTHON_EXE=python"
)

"%PYTHON_EXE%" run.py %*
if %ERRORLEVEL% neq 0 (
    pause
)
