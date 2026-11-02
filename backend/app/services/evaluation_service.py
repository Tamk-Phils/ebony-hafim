import os
import time
import uuid
import psutil
from pathlib import Path
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from backend.app.core.security import compute_sha256_stream
from backend.app.models.all_models import EvaluationRun
from backend.app.services.tee_service import tee_service
from tee.interfaces.base import BaselineFileEntry

class EvaluationService:
    def __init__(self, eval_dir: str = "/tmp/hafim_eval"):
        self.eval_dir = eval_dir

    def _prepare_eval_files(self, count: int, file_size_kb: int = 16) -> List[str]:
        os.makedirs(self.eval_dir, exist_ok=True)
        file_paths = []
        payload = os.urandom(file_size_kb * 1024)
        for i in range(count):
            p = os.path.join(self.eval_dir, f"eval_sample_{i:04d}.bin")
            with open(p, "wb") as f:
                f.write(payload)
            file_paths.append(p)
        return file_paths

    def run_benchmark(
        self,
        db: Session,
        admin_token: str,
        num_files: int = 50,
        file_size_kb: int = 32,
        mode: str = "CURRENT_MODE"
    ) -> Dict[str, Any]:
        process = psutil.Process(os.getpid())
        cpu_start = process.cpu_percent(interval=None)
        mem_start_mb = process.memory_info().rss / (1024 * 1024)

        file_paths = self._prepare_eval_files(num_files, file_size_kb)
        total_bytes = num_files * file_size_kb * 1024

        # 1. Measure Hash Computation Time
        t0 = time.perf_counter()
        hashes = {}
        for p in file_paths:
            hashes[p] = compute_sha256_stream(p)
        hash_calc_time_ms = (time.perf_counter() - t0) * 1000

        # 2. Baseline Initialization in TEE
        entries = [
            BaselineFileEntry(
                file_path=p,
                sha256_hash=h,
                size_bytes=file_size_kb * 1024,
                permissions="0644"
            ) for p, h in hashes.items()
        ]
        tee_service.adapter.initialize_baseline(entries, admin_token)

        # 3. Measure End-to-End Verification Latency & TEE Communication Overhead
        t_verify_start = time.perf_counter()
        false_positives = 0
        seq = 1000
        for p, h in hashes.items():
            seq += 1
            res = tee_service.adapter.verify_file(
                file_path=p,
                observed_hash=h,
                size_bytes=file_size_kb * 1024,
                permissions="0644",
                sequence_no=seq
            )
            if res.verdict != "MATCH":
                false_positives += 1
        end_to_end_latency_ms = (time.perf_counter() - t_verify_start) * 1000
        tee_comm_time_ms = max(0.0, end_to_end_latency_ms - (hash_calc_time_ms * 0.1))

        # 4. Measure Detection Latency on Tampered Files
        false_negatives = 0
        t_detect_start = time.perf_counter()
        tamper_target = file_paths[0]
        # Introduce unauthorized modification
        with open(tamper_target, "ab") as f:
            f.write(b"TAMPER_PAYLOAD")
        tampered_hash = compute_sha256_stream(tamper_target)
        seq += 1
        res = tee_service.adapter.verify_file(
            file_path=tamper_target,
            observed_hash=tampered_hash,
            size_bytes=os.path.getsize(tamper_target),
            permissions="0644",
            sequence_no=seq
        )
        detection_latency_ms = (time.perf_counter() - t_detect_start) * 1000
        if res.verdict != "TAMPERED":
            false_negatives += 1

        # Resource Utilization
        cpu_end = process.cpu_percent(interval=None)
        mem_end_mb = process.memory_info().rss / (1024 * 1024)
        throughput = num_files / max(0.001, (end_to_end_latency_ms / 1000.0))

        actual_mode = tee_service.get_status().mode

        run_record = EvaluationRun(
            run_uuid=str(uuid.uuid4()),
            mode=actual_mode,
            num_files=num_files,
            total_size_bytes=total_bytes,
            hash_calc_time_ms=round(hash_calc_time_ms, 2),
            tee_comm_time_ms=round(tee_comm_time_ms, 2),
            end_to_end_latency_ms=round(end_to_end_latency_ms, 2),
            detection_latency_ms=round(detection_latency_ms, 2),
            cpu_percent=round(max(cpu_start, cpu_end), 2),
            memory_mb=round(mem_end_mb, 2),
            throughput_files_per_sec=round(throughput, 2),
            false_positives=false_positives,
            false_negatives=false_negatives,
            notes=f"Empirical benchmark run on {num_files} files ({file_size_kb} KB each)."
        )

        db.add(run_record)
        db.commit()
        db.refresh(run_record)

        return {
            "id": run_record.id,
            "run_uuid": run_record.run_uuid,
            "mode": run_record.mode,
            "num_files": run_record.num_files,
            "total_size_bytes": run_record.total_size_bytes,
            "hash_calc_time_ms": run_record.hash_calc_time_ms,
            "tee_comm_time_ms": run_record.tee_comm_time_ms,
            "end_to_end_latency_ms": run_record.end_to_end_latency_ms,
            "detection_latency_ms": run_record.detection_latency_ms,
            "cpu_percent": run_record.cpu_percent,
            "memory_mb": run_record.memory_mb,
            "throughput_files_per_sec": run_record.throughput_files_per_sec,
            "false_positives": run_record.false_positives,
            "false_negatives": run_record.false_negatives,
            "timestamp": run_record.timestamp.isoformat()
        }

evaluation_service = EvaluationService()
