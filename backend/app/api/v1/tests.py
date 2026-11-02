from typing import List
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.all_models import TestExecution
from backend.app.schemas.schemas import TestResultItem
from backend.app.services.test_runner_service import test_runner_service
from backend.app.api.deps import get_admin_and_token, get_current_admin, log_audit

router = APIRouter(prefix="/tests", tags=["Testing & Evaluation"])

@router.get("", response_model=List[TestResultItem])
def get_test_results(
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    tests = db.query(TestExecution).order_by(TestExecution.execution_time.desc()).limit(100).all()
    return [
        TestResultItem(
            id=t.id,
            test_name=t.test_name,
            status=t.status,
            expected_outcome=t.expected_outcome,
            actual_outcome=t.actual_outcome,
            latency_ms=t.latency_ms,
            event_id=t.event_id,
            error_message=t.error_message,
            execution_time=t.execution_time.isoformat()
        ) for t in tests
    ]

@router.post("/run", response_model=List[TestResultItem])
def run_tests(
    request: Request,
    auth_data = Depends(get_admin_and_token),
    db: Session = Depends(get_db)
):
    admin, token = auth_data
    results = test_runner_service.run_all_tests(db, token)
    log_audit(db, admin.username, "RUN_INTEGRITY_TESTS", "sandbox_evaluator", f"Executed {len(results)} automated test scenarios.", request)
    return results
