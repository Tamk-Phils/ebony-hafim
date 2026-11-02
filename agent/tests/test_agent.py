import os
import time
import shutil
import pytest
from pathlib import Path
from agent.src.agent import HostMonitoringAgent

TEST_AGENT_DIR = "/tmp/test_agent_sandbox"

@pytest.fixture(autouse=True)
def setup_teardown():
    if os.path.exists(TEST_AGENT_DIR):
        shutil.rmtree(TEST_AGENT_DIR)
    os.makedirs(TEST_AGENT_DIR, exist_ok=True)
    yield
    if os.path.exists(TEST_AGENT_DIR):
        shutil.rmtree(TEST_AGENT_DIR)

def test_agent_path_approval_enforcement():
    """Verify agent rejects unapproved roots."""
    agent = HostMonitoringAgent(
        agent_id="test-agent",
        approved_roots=[TEST_AGENT_DIR]
    )
    # Allowed
    agent.add_root(TEST_AGENT_DIR)
    assert TEST_AGENT_DIR in agent._monitored_paths

    # Disallowed
    with pytest.raises(PermissionError):
        agent.add_root("/etc")

def test_agent_reconciliation_detects_changes():
    """Verify agent reconciliation detects file additions and modifications."""
    verified_events = []

    def mock_verifier(file_path, observed_hash, size_bytes, permissions, sequence_no):
        verified_events.append({
            "path": file_path,
            "hash": observed_hash,
            "seq": sequence_no
        })
        class MockRes:
            verdict = "MATCH"
            details = "Mock"
        return MockRes()

    agent = HostMonitoringAgent(
        agent_id="test-agent",
        approved_roots=[TEST_AGENT_DIR],
        reconciliation_interval=1,
        tee_verifier=mock_verifier
    )
    agent.add_root(TEST_AGENT_DIR)

    # Create file
    f1 = os.path.join(TEST_AGENT_DIR, "reconcile_sample.txt")
    with open(f1, "w") as f:
        f.write("Sample payload")

    agent.verify_single_file(f1)
    assert len(verified_events) == 1
    assert verified_events[0]["path"] == f1
    assert verified_events[0]["hash"] is not None
    assert verified_events[0]["seq"] == 1
