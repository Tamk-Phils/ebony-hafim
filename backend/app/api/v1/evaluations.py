import io
import csv
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from backend.app.database.session import get_db
from backend.app.models.all_models import EvaluationRun
from backend.app.schemas.schemas import RunBenchmarkRequest, BenchmarkResultResponse
from backend.app.services.evaluation_service import evaluation_service
from backend.app.api.deps import get_admin_and_token, get_current_admin, log_audit

router = APIRouter(prefix="/evaluations", tags=["Performance Evaluation"])

@router.post("/run", response_model=BenchmarkResultResponse)
def run_evaluation(
    req: RunBenchmarkRequest,
    request: Request,
    auth_data = Depends(get_admin_and_token),
    db: Session = Depends(get_db)
):
    admin, token = auth_data
    res = evaluation_service.run_benchmark(
        db=db,
        admin_token=token,
        num_files=req.num_files,
        file_size_kb=req.file_size_kb
    )
    log_audit(db, admin.username, "RUN_BENCHMARK", "empirical_evaluator", f"Files: {req.num_files}, Size: {req.file_size_kb}KB, E2E Latency: {res['end_to_end_latency_ms']}ms", request)
    return res

@router.get("", response_model=List[BenchmarkResultResponse])
def get_evaluations(
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    runs = db.query(EvaluationRun).order_by(EvaluationRun.timestamp.desc()).all()
    return [
        BenchmarkResultResponse(
            id=r.id,
            run_uuid=r.run_uuid,
            mode=r.mode,
            num_files=r.num_files,
            total_size_bytes=r.total_size_bytes,
            hash_calc_time_ms=r.hash_calc_time_ms,
            tee_comm_time_ms=r.tee_comm_time_ms,
            end_to_end_latency_ms=r.end_to_end_latency_ms,
            detection_latency_ms=r.detection_latency_ms,
            cpu_percent=r.cpu_percent,
            memory_mb=r.memory_mb,
            throughput_files_per_sec=r.throughput_files_per_sec,
            false_positives=r.false_positives,
            false_negatives=r.false_negatives,
            timestamp=r.timestamp.isoformat()
        ) for r in runs
    ]

@router.get("/export")
def export_evaluations_csv(
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    runs = db.query(EvaluationRun).order_by(EvaluationRun.timestamp.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Run ID", "UUID", "Timestamp", "Mode", "Num Files", "Total Size (Bytes)",
        "Hash Calc Time (ms)", "TEE Comm Time (ms)", "End-to-End Latency (ms)",
        "Detection Latency (ms)", "CPU (%)", "Memory (MB)", "Throughput (files/sec)",
        "False Positives", "False Negatives"
    ])
    for r in runs:
        writer.writerow([
            r.id, r.run_uuid, r.timestamp.isoformat(), r.mode, r.num_files, r.total_size_bytes,
            r.hash_calc_time_ms, r.tee_comm_time_ms, r.end_to_end_latency_ms,
            r.detection_latency_ms, r.cpu_percent, r.memory_mb, r.throughput_files_per_sec,
            r.false_positives, r.false_negatives
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=hafim_empirical_benchmarks.csv"}
    )
