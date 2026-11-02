import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "HA-FIM (Hardware-Assisted File Integrity Monitoring)"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security & Authentication
    SECRET_KEY: str = "hafim_super_secret_cybersecurity_research_prototype_key_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours
    
    # Database
    DATABASE_URL: str = (
        "sqlite:////tmp/hafim.db"
        if os.environ.get("VERCEL")
        else "sqlite:///./hafim.db"
    )
    
    # TEE Configuration
    # Modes: DEVELOPMENT_SOFTWARE_ONLY, NITRO_ENCLAVE_HARDWARE, TEST_MOCK_ONLY
    TEE_MODE: str = "DEVELOPMENT_SOFTWARE_ONLY"
    NITRO_VSOCK_CID: int = 16
    NITRO_VSOCK_PORT: int = 5000
    NITRO_EXPECTED_PCR0: str = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    NITRO_EXPECTED_PCR1: str = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    NITRO_EXPECTED_PCR2: str = "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    
    # Approved Monitoring Roots (Administrator approved sandbox/root directories)
    APPROVED_ROOTS: List[str] = [
        str(Path.home() / "Desktop/apps/ebony/sandbox"),
        str(Path.home() / "Desktop/apps/ebony/test_sandbox"),
        "/tmp/hafim_sandbox",
        "/tmp/hafim_eval"
    ]
    
    # Monitoring Engine Configuration
    RECONCILIATION_INTERVAL_SECONDS: int = 15
    AGENT_HEARTBEAT_TIMEOUT_SECONDS: int = 30
    MAX_FILE_SIZE_BYTES: int = 100 * 1024 * 1024  # 100 MB max for direct hashing
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
