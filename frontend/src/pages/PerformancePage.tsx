import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Play,
  Download,
  Clock,
  Cpu,
  Layers,
  Activity,
  CheckCircle2,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { BenchmarkResult } from '../types';
import { api } from '../services/api';

export const PerformancePage: React.FC = () => {
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Configuration params
  const [numFiles, setNumFiles] = useState(50);
  const [fileSizeKb, setFileSizeKb] = useState(32);

  const loadBenchmarks = async () => {
    try {
      setLoading(true);
      const data = await api.getEvaluations();
      setBenchmarks(data);
    } catch (e) {
      console.error('Failed to load performance benchmarks', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBenchmarks();
  }, []);

  const handleRunBenchmark = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setRunning(true);
      const result = await api.runBenchmark(numFiles, fileSizeKb);
      await loadBenchmarks();
    } catch (e: any) {
      alert(`Benchmark execution failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const latestRun = benchmarks[0] || null;

  // Chart data formatting: chronological
  const chartData = [...benchmarks].reverse().map((b, idx) => ({
    run: `#${idx + 1} (${b.num_files}f)`,
    e2eLatency: b.end_to_end_latency_ms,
    hashTime: b.hash_calc_time_ms,
    teeCommTime: b.tee_comm_time_ms,
    throughput: b.throughput_files_per_sec,
    cpuPercent: b.cpu_percent
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Empirical Performance Evaluation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Quantitative benchmarks measuring cryptographic throughput, enclave overhead, and system latency
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href={api.getEvaluationsExportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-200 text-xs font-medium border border-cyber-700 flex items-center gap-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export Benchmark CSV
          </a>
        </div>
      </div>

      {/* Benchmark Execution Controls Box */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
          <Play className="w-4 h-4 text-cyan-400 fill-current" />
          Configure Empirical Benchmark Run
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Generates real test payloads in memory, calculates SHA-256 digests, and measures TEE roundtrip verification latency.
        </p>

        <form onSubmit={handleRunBenchmark} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Batch Size (File Count)</label>
            <select
              value={numFiles}
              onChange={(e) => setNumFiles(Number(e.target.value))}
              className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            >
              <option value={10}>10 Files (Micro benchmark)</option>
              <option value={50}>50 Files (Standard evaluation)</option>
              <option value={100}>100 Files (Stress evaluation)</option>
              <option value={200}>200 Files (High throughput)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">File Payload Size</label>
            <select
              value={fileSizeKb}
              onChange={(e) => setFileSizeKb(Number(e.target.value))}
              className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-400"
            >
              <option value={4}>4 KB (Small config files)</option>
              <option value={32}>32 KB (Typical binary/config)</option>
              <option value={128}>128 KB (Medium binaries)</option>
              <option value={512}>512 KB (Large system files)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={running}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium p-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            >
              {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {running ? 'Running Benchmark...' : 'Execute Empirical Benchmark'}
            </button>
          </div>
        </form>
      </div>

      {/* Latest Benchmark Metric Cards */}
      {latestRun && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Throughput</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-300">
              {latestRun.throughput_files_per_sec} <span className="text-xs font-normal text-slate-400">files/s</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Processed {latestRun.num_files} files</div>
          </div>

          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>End-to-End Latency</span>
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {latestRun.end_to_end_latency_ms} <span className="text-xs font-normal text-slate-400">ms</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Total verification roundtrip</div>
          </div>

          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Detection Latency</span>
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-purple-300">
              {latestRun.detection_latency_ms} <span className="text-xs font-normal text-slate-400">ms</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Tamper detection response</div>
          </div>

          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Resource Footprint</span>
              <HardDrive className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-300">
              {latestRun.memory_mb} <span className="text-xs font-normal text-slate-400">MB</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">CPU overhead: {latestRun.cpu_percent}%</div>
          </div>
        </div>
      )}

      {/* Latency and Throughput Visual Charts */}
      {benchmarks.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Verification Latency Trends (ms)</h3>
            <p className="text-xs text-slate-400 mb-4">End-to-End latency vs. Cryptographic hashing computation</p>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="run" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0b1325', borderColor: '#1e335f', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="e2eLatency" stroke="#06b6d4" name="End-to-End (ms)" strokeWidth={2} />
                  <Line type="monotone" dataKey="hashTime" stroke="#10b981" name="SHA-256 Hashing (ms)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-1">Throughput Capacity (files/sec)</h3>
            <p className="text-xs text-slate-400 mb-4">Throughput across experimental configurations</p>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="run" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0b1325', borderColor: '#1e335f', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="throughput" fill="#8b5cf6" name="Throughput (files/s)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Historical Benchmark Runs Table */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cyber-800">
          <h3 className="text-sm font-semibold text-slate-200">Historical Empirical Evaluation Records</h3>
          <p className="text-xs text-slate-400">Verifiable benchmark results with zero fabricated measurements</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[780px]">
            <thead className="bg-cyber-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-cyber-800">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Files</th>
                <th className="px-4 py-3">Total Size</th>
                <th className="px-4 py-3">E2E Latency</th>
                <th className="px-4 py-3">Detection Latency</th>
                <th className="px-4 py-3">Throughput</th>
                <th className="px-4 py-3">False Pos/Neg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-800/60 font-mono text-[11px]">
              {benchmarks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans text-xs">
                    No empirical benchmarks recorded. Configure and run your first benchmark above.
                  </td>
                </tr>
              ) : (
                benchmarks.map((b) => (
                  <tr key={b.id} className="hover:bg-cyber-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400">{new Date(b.timestamp).toLocaleTimeString()}</td>
                    <td className="px-4 py-2.5 font-sans">
                      <span className="px-2 py-0.5 rounded bg-cyber-800 text-slate-300 border border-cyber-700 text-[10px]">
                        {b.mode}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-200">{b.num_files}</td>
                    <td className="px-4 py-2.5 text-slate-300">{(b.total_size_bytes / 1024).toFixed(1)} KB</td>
                    <td className="px-4 py-2.5 text-cyan-400 font-semibold">{b.end_to_end_latency_ms} ms</td>
                    <td className="px-4 py-2.5 text-purple-300">{b.detection_latency_ms} ms</td>
                    <td className="px-4 py-2.5 text-emerald-400 font-semibold">{b.throughput_files_per_sec} f/s</td>
                    <td className="px-4 py-2.5 text-slate-400">{b.false_positives} / {b.false_negatives}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
