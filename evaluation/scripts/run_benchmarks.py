#!/usr/bin/env python3
"""
CLI script to run empirical performance benchmarks on HA-FIM.
"""

import sys
import argparse
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.app.database.session import SessionLocal, Base, engine
from backend.app.core.security import create_access_token
from backend.app.services.evaluation_service import evaluation_service

def main():
    parser = argparse.ArgumentParser(description="Run HA-FIM Empirical Performance Benchmarks")
    parser.add_argument("--files", type=int, default=50, help="Number of files to evaluate")
    parser.add_argument("--size-kb", type=int, default=32, help="File size in kilobytes")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    token = create_access_token("admin_benchmark_runner")

    print(f"[*] Starting empirical benchmark: {args.files} files ({args.size_kb} KB each)...")
    res = evaluation_service.run_benchmark(db, token, args.files, args.size_kb)

    print("\n" + "="*50)
    print("        HA-FIM EMPIRICAL BENCHMARK RESULTS")
    print("="*50)
    print(f"Run UUID:               {res['run_uuid']}")
    print(f"Deployment Mode:        {res['mode']}")
    print(f"Files Processed:        {res['num_files']}")
    print(f"Total Data Hashed:      {res['total_size_bytes'] / 1024:.1f} KB")
    print(f"Hash Computation Time:  {res['hash_calc_time_ms']:.2f} ms")
    print(f"TEE Comm Overhead:      {res['tee_comm_time_ms']:.2f} ms")
    print(f"End-to-End Latency:     {res['end_to_end_latency_ms']:.2f} ms")
    print(f"Detection Latency:      {res['detection_latency_ms']:.2f} ms")
    print(f"Throughput:             {res['throughput_files_per_sec']:.2f} files/sec")
    print(f"CPU Utilization:        {res['cpu_percent']:.1f}%")
    print(f"Memory Footprint:       {res['memory_mb']:.1f} MB")
    print(f"False Positives:        {res['false_positives']}")
    print(f"False Negatives:        {res['false_negatives']}")
    print("="*50)
    print("[+] Benchmark results saved to database.")

    db.close()

if __name__ == "__main__":
    main()
