import os
import shutil
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database.session import Base, get_db
from backend.app.main import app
from backend.app.core.security import compute_sha256_stream, hash_password, create_access_token
from backend.app.models.all_models import Admin, MonitoringTarget, MonitoredFile, Baseline
from backend.app.services.fim_service import fim_service
from backend.app.services.tee_service import tee_service
from tee.interfaces.base import BaselineFileEntry
from tee.adapters.software_dev_adapter import SoftwareDevTEEAdapter
from tee.adapters.nitro_enclave_adapter import NitroEnclaveTEEAdapter, HardwareUnavailableError

# Test SQLite in-memory / temporary database
TEST_DB_FILE = "/tmp/test_hafim.db"
TEST_SANDBOX = "/tmp/test_hafim_sandbox"
test_engine = create_engine(f"sqlite:///{TEST_DB_FILE}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_test_env():
    # Setup database
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)
    Base.metadata.create_all(bind=test_engine)

    # Setup sandbox
    if os.path.exists(TEST_SANDBOX):
        shutil.rmtree(TEST_SANDBOX)
    os.makedirs(TEST_SANDBOX, exist_ok=True)

    # Seed test admin
    db = TestingSessionLocal()
    admin = Admin(
        username="unit_test_admin",
        hashed_password=hash_password("UnitTestSecret123!"),
        is_active=True
    )
    db.add(admin)
    db.commit()
    db.close()

    yield

    # Teardown
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)
    if os.path.exists(TEST_SANDBOX):
        shutil.rmtree(TEST_SANDBOX)

def test_sha256_stream_correctness():
    """Verify SHA-256 calculation matches known cryptographic vector."""
    test_path = os.path.join(TEST_SANDBOX, "crypto_test.txt")
    with open(test_path, "wb") as f:
        f.write(b"HA-FIM cryptographic validation payload")
    
    # SHA-256 of "HA-FIM cryptographic validation payload"
    # echo -n "HA-FIM cryptographic validation payload" | sha256sum
    # 44df1d368e73ee515eb89e6eb1adcb404c09d5eb458df8645e0d37e6d09f58ea
    digest = compute_sha256_stream(test_path)
    import hashlib
    expected = hashlib.sha256(b"HA-FIM cryptographic validation payload").hexdigest()
    assert digest == expected

def test_software_adapter_baseline_and_verification():
    """Verify TEE Software Dev Adapter enforces baseline and detects tampering."""
    adapter = SoftwareDevTEEAdapter()
    token = create_access_token("unit_test_admin")

    file1 = os.path.join(TEST_SANDBOX, "file1.conf")
    with open(file1, "w") as f:
        f.write("Legitimate config")

    h1 = compute_sha256_stream(file1)
    init_res = adapter.initialize_baseline([
        BaselineFileEntry(file_path=file1, sha256_hash=h1, size_bytes=len("Legitimate config"), permissions="0644")
    ], admin_token=token)

    assert init_res.success is True
    assert init_res.version == 1

    # Verify unchanged
    v_clean = adapter.verify_file(file1, h1, len("Legitimate config"), "0644", sequence_no=1)
    assert v_clean.verdict == "MATCH"
    assert v_clean.hardware_isolated is False
    assert v_clean.mode_label == "DEVELOPMENT_SOFTWARE_ONLY"

    # Verify tampered
    tampered_hash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    v_tampered = adapter.verify_file(file1, tampered_hash, 100, "0644", sequence_no=2)
    assert v_tampered.verdict == "TAMPERED"

    # Verify deletion
    v_deleted = adapter.verify_file(file1, None, 0, "0000", sequence_no=3)
    assert v_deleted.verdict == "DELETED"

    # Verify permissions changed
    v_perm = adapter.verify_file(file1, h1, len("Legitimate config"), "0777", sequence_no=4)
    assert v_perm.verdict == "PERMISSION_CHANGED"

def test_software_adapter_rejects_unauthorized_update():
    """Verify unauthorized baseline update without valid admin token is rejected."""
    adapter = SoftwareDevTEEAdapter()
    token = create_access_token("unit_test_admin")

    file1 = os.path.join(TEST_SANDBOX, "file1.conf")
    h1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    adapter.initialize_baseline([
        BaselineFileEntry(file_path=file1, sha256_hash=h1, size_bytes=10, permissions="0644")
    ], admin_token=token)

    # Attempt with forged token
    res = adapter.approve_baseline_update(
        file_path=file1,
        new_hash="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        admin_token="forged.invalid.jwt",
        sequence_no=10
    )
    assert res.success is False
    assert "Unauthorized" in res.error

def test_software_adapter_anti_replay_protection():
    """Verify requests with stale sequence numbers are rejected."""
    adapter = SoftwareDevTEEAdapter()
    token = create_access_token("unit_test_admin")

    file1 = os.path.join(TEST_SANDBOX, "file1.conf")
    h1 = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    adapter.initialize_baseline([
        BaselineFileEntry(file_path=file1, sha256_hash=h1, size_bytes=10, permissions="0644")
    ], admin_token=token)

    # Sequence 10 accepted
    res1 = adapter.verify_file(file1, h1, 10, "0644", sequence_no=10)
    assert res1.verdict == "MATCH"

    # Sequence 5 (stale) rejected
    res2 = adapter.verify_file(file1, h1, 10, "0644", sequence_no=5)
    assert res2.verdict == "REPLAY_DETECTED"

def test_nitro_adapter_fails_safely_when_hardware_unavailable():
    """Verify hardware adapter does NOT silently fall back to software mode."""
    # When AF_VSOCK is unreachable or unsupported, it must fail safely
    adapter = NitroEnclaveTEEAdapter(cid=16, port=5000)
    status = adapter.get_platform_status()
    assert status.hardware_backed is True
    assert status.mode == "NITRO_ENCLAVE_HARDWARE"
    
    # Verification should return HARDWARE_UNAVAILABLE verdict rather than crashing or faking success
    res = adapter.verify_file("/test", "hash", 10, "0644", sequence_no=1)
    assert res.verdict == "HARDWARE_UNAVAILABLE"
    assert res.hardware_isolated is False

def test_api_auth_and_dashboard():
    """Test API authentication and summary metrics."""
    # 1. Login
    login_resp = client.post("/api/v1/auth/login", json={
        "username": "unit_test_admin",
        "password": "UnitTestSecret123!"
    })
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    token = token_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Me
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == "unit_test_admin"

    # 3. Get Dashboard Summary
    dash_resp = client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash_resp.status_code == 200
    summary = dash_resp.json()
    assert "total_monitored_files" in summary
    assert "tee_deployment_mode" in summary
    assert summary["tee_hardware_warning"] is not None

def test_api_test_runner_execution():
    """Test running automated safe integrity tests via API."""
    token = create_access_token("unit_test_admin")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/tests/run", headers=headers)
    assert resp.status_code == 200
    results = resp.json()
    assert len(results) == 10
    passed_count = sum(1 for r in results if r["status"] == "PASSED")
    # All 10 tests should pass cleanly
    assert passed_count == 10
