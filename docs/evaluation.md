# HA-FIM: Empirical Evaluation & Performance Methodology

### 1. Research Motivation

A central question in the research proposal *"Hardware-Assisted File Integrity Monitoring Using Trusted Execution Environments (TEEs) in Cloud Infrastructure"* is:

> *What is the operational performance overhead introduced by isolating the baseline database and comparison engine inside a hardware-backed TEE compared to conventional software-based FIM architectures?*

---

### 2. Experimental Metrics

The HA-FIM empirical evaluation framework measures:
1. **Hash Computation Latency ($T_{\text{hash}}$)**: Time spent streaming file contents into standard SHA-256 blocks.
2. **TEE Communication Overhead ($T_{\text{comm}}$)**: Time spent serializing verification payloads and traversing the communication channel (`AF_VSOCK` or local socket).
3. **End-to-End Verification Latency ($T_{\text{e2e}}$)**: Total wall-clock time from filesystem read to receipt validation ($T_{\text{hash}} + T_{\text{comm}} + T_{\text{compare}}$).
4. **Detection Latency ($T_{\text{detect}}$)**: Time elapsed from the introduction of an unauthorized modification to receipt of a signed `TAMPERED` verdict.
5. **Throughput ($\Phi$)**: Processed files per second ($\Phi = N / T_{\text{e2e}}$).
6. **Host Resource Utilization**: CPU overhead percentage and process resident set memory (RSS in MB) sampled via Linux `psutil`.
7. **Accuracy Rates**:
   - False Positives ($FP$): Clean files erroneously marked tampered.
   - False Negatives ($FN$): Tampered files erroneously marked clean.

---

### 3. Empirical Benchmark Automation

Benchmarks can be triggered programmatically using `evaluation/scripts/run_benchmarks.py` or through Page 7 of the web dashboard.

```bash
./venv/bin/python evaluation/scripts/run_benchmarks.py --files 100 --size-kb 32
```

Results are committed to the SQLite/PostgreSQL `evaluation_runs` table and exported as reproducible CSV datasets for academic papers and graph generation.
