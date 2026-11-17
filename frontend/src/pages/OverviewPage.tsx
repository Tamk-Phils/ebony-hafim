import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  AlertTriangle,
  AlertOctagon,
  Cpu,
  Clock,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Activity,
  ArrowUpRight,
  Server,
  HardDrive,
  Lock,
  Radio,
  Layers,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DashboardSummary } from '../types';
import { api } from '../services/api';

interface OverviewPageProps {
  onNavigate: (page: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);
  const [showArchDetails, setShowArchDetails] = useState<boolean>(true);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const data = await api.getSummary();
      setSummary(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load telemetry summary');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerScan = async () => {
    try {
      setScanning(true);
      await api.triggerScan();
      await loadSummary();
    } catch (err: any) {
      alert(`Integrity sweep failed: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadSummary();
    const timer = setInterval(loadSummary, 10000);
    return () => clearInterval(timer);
  }, []);

  const chartColors: Record<string, string> = {
    MODIFICATION: '#ef4444',
    CREATION: '#f59e0b',
    DELETION: '#f43f5e',
    PERMISSION_CHANGE: '#8b5cf6',
    BASELINE_VIOLATION: '#ec4899',
    REPLAY_ATTACK: '#dc2626',
    TEE_ERROR: '#ef4444',
    NO_EVENTS: '#334155'
  };

  // Workflow steps representing the "Locked Security Office" concept
  const workflowSteps = [
    {
      step: 1,
      title: "Host Filesystem",
      subtitle: "Windows & Linux Targets",
      description: "Monitors target files, directories, and binaries on the untrusted host operating system. Subject to real-time OS modification and creation events.",
      guarantee: "Untrusted zone: an attacker with root or SYSTEM privileges could alter files or try to manipulate monitoring tools here.",
      icon: HardDrive
    },
    {
      step: 2,
      title: "Host Agent",
      subtitle: "Inotify & Win32 Watcher",
      description: "Calculates digital fingerprints (SHA-256 hashes) and metadata immediately when filesystem events occur, backed by automated periodic sweeps.",
      guarantee: "Computes SHA-256 streams efficiently; dispatches fingerprints across the narrow TEE socket with monotonic sequence numbers.",
      icon: Radio
    },
    {
      step: 3,
      title: "Isolated Channel",
      subtitle: "AF_VSOCK / Anti-Replay",
      description: "Communicates across a narrow virtual socket or isolated channel. Each transmission carries a strictly monotonic sequence counter.",
      guarantee: "Anti-replay protection: Replayed clean-state tokens or suppressed alert frames are cryptographically rejected.",
      icon: Layers
    },
    {
      step: 4,
      title: "Protected Enclave Room",
      subtitle: "AWS Nitro TEE / Locked Office",
      description: "Sensitive verification logic and the authoritative reference fingerprints reside inside enclave memory, inaccessible even to host kernel attacks.",
      guarantee: "Locked office guarantee: Host kernel cannot read or tamper with enclave memory. Comparison and signed receipts happen in isolation.",
      icon: Lock
    }
  ];

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2.5 text-sky-400" />
        <span className="text-sm">Loading security telemetry...</span>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300">
        <div className="font-semibold text-sm mb-1">Telemetry Retrieval Error</div>
        <div className="text-xs">{error}</div>
        <button
          onClick={loadSummary}
          className="mt-4 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const host = summary?.host_telemetry;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Integrity Operations Console
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700/60">
              Baseline {summary?.last_baseline_version ? `v${summary.last_baseline_version}` : 'Uninitialized'}
            </span>
            {host && (
              <span className="text-xs px-2.5 py-0.5 rounded bg-sky-500/10 text-sky-300 font-mono border border-sky-500/20 flex items-center gap-1">
                <Server className="w-3 h-3 text-sky-400" />
                {host.os_name} ({host.architecture})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time hardware-assisted integrity verification across Linux and Windows cloud endpoints
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleTriggerScan}
            disabled={scanning}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin text-sky-400' : ''}`} />
            {scanning ? 'Sweeping Targets...' : 'Run Integrity Sweep'}
          </button>
          <button
            onClick={() => onNavigate('files')}
            className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add Monitored Target
          </button>
        </div>
      </div>

      {/* Real-Time Architecture & Workflow Panel ("The Locked Office") */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                Real-Time Enclave Architecture: The "Locked Security Office"
              </h2>
              <p className="text-xs text-slate-400">
                How HA-FIM isolates reference fingerprints and comparison logic from host operating system compromise
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowArchDetails(!showArchDetails)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium"
          >
            {showArchDetails ? 'Collapse Diagram' : 'Expand Diagram'}
            {showArchDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showArchDetails && (
          <div className="p-5 space-y-5">
            {/* 4-Step Interactive Pipeline Flow */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {workflowSteps.map((step, idx) => {
                const Icon = step.icon;
                const isSelected = activeWorkflowStep === idx;
                return (
                  <button
                    key={step.step}
                    onClick={() => setActiveWorkflowStep(idx)}
                    className={`text-left p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-slate-850 border-sky-500/60 shadow-sm ring-1 ring-sky-500/30'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        isSelected ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        Stage {step.step}
                      </span>
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-sky-400' : 'text-slate-500'}`} />
                    </div>
                    <div className="font-semibold text-xs text-slate-200">{step.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{step.subtitle}</div>
                  </button>
                );
              })}
            </div>

            {/* Selected Stage Forensic Detail Box */}
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-lg space-y-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                <Info className="w-4 h-4 text-sky-400" />
                <span>
                  Stage {workflowSteps[activeWorkflowStep].step}: {workflowSteps[activeWorkflowStep].title} — Operational Role & Security Boundary
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {workflowSteps[activeWorkflowStep].description}
              </p>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800/80 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold uppercase tracking-wider text-[10px] mr-1.5">
                  Security Guarantee:
                </span>
                {workflowSteps[activeWorkflowStep].guarantee}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monitored Files */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Monitored Files</span>
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-100">
              {summary?.total_monitored_files || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="text-emerald-400 font-medium">{summary?.files_matching_baseline || 0}</span> matching baseline
            </div>
          </div>
        </div>

        {/* Integrity Violations */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Integrity Violations</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold font-mono ${summary?.files_with_violations ? 'text-rose-400' : 'text-slate-100'}`}>
              {summary?.files_with_violations || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {summary?.files_with_violations ? (
                <span className="text-rose-400 font-medium">Attention Required</span>
              ) : (
                <span className="text-emerald-400 font-medium">All Files Verified</span>
              )}
            </div>
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Open Critical Alerts</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-amber-300">
              {summary?.critical_events_count || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              <span className="text-slate-300 font-medium">{summary?.high_events_count || 0}</span> high severity incidents
            </div>
          </div>
        </div>

        {/* TEE Platform Boundary */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">TEE Protected Boundary</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs font-bold font-mono text-indigo-300 truncate">
              {summary?.tee_hardware_backed ? 'AWS NITRO ENCLAVE' : 'SOFTWARE EMULATION'}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${summary?.tee_connection_status ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span>{summary?.tee_connection_status ? 'Channel Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Activity Chart & Endpoint Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detection Activity Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                Detection Activity by Event Type
              </h3>
              <p className="text-xs text-slate-400">Distribution of authenticated filesystem events recorded</p>
            </div>
            <button
              onClick={() => onNavigate('events')}
              className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-medium"
            >
              All Events <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary?.detection_activity_chart || []}>
                <XAxis dataKey="type" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#0284c7' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {(summary?.detection_activity_chart || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[entry.type] || '#0284c7'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Host Endpoint & TEE Status Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              Endpoint & Engine Telemetry
            </h3>
            <p className="text-xs text-slate-400 mb-4">Live node configuration and operational health</p>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Host Endpoint</span>
                <span className="font-mono text-slate-200 font-medium truncate max-w-[150px]">
                  {host?.hostname || 'host-agent-01'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Operating System</span>
                <span className="font-mono text-slate-200 font-medium">
                  {host?.os_platform || 'Cross-Platform Linux/Windows'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Monitoring Engine</span>
                <span className="font-mono text-slate-300 text-[11px] truncate max-w-[150px]">
                  {host?.monitoring_backend || 'Win32 / inotify'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Last Integrity Sweep</span>
                <span className="font-mono text-slate-200">
                  {summary?.last_scan_time ? new Date(summary.last_scan_time).toLocaleTimeString() : 'Never'}
                </span>
              </div>

              <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Baseline Version</span>
                <span className="font-mono text-sky-400 font-semibold">
                  v{summary?.last_baseline_version || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
            <strong className="text-slate-300">Monotonic Sequencing:</strong> Every verification verdict issued by the TEE carries a sequential monotonic counter to prevent replay of clean state.
          </div>
        </div>
      </div>

      {/* Recent Security Events Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Recent Integrity Violations</h3>
            <p className="text-xs text-slate-400">Authenticated event notification log from TEE comparison engine</p>
          </div>
          <button
            onClick={() => onNavigate('events')}
            className="text-xs text-sky-400 hover:underline flex items-center gap-1 font-medium"
          >
            Inspect All <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Target Path</th>
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">TEE Verdict</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
              {(!summary?.recent_events || summary.recent_events.length === 0) ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 font-sans text-xs">
                    No integrity violations detected. Filesystem is currently consistent with authoritative baseline.
                  </td>
                </tr>
              ) : (
                summary.recent_events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2.5 text-slate-200 font-medium truncate max-w-xs" title={evt.file_path}>
                      {evt.file_path}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">
                      {evt.event_type}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        evt.severity === 'CRITICAL' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' :
                        evt.severity === 'HIGH' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                        'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      }`}>
                        {evt.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 font-medium">
                      {evt.tee_verdict}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                        {evt.status}
                      </span>
                    </td>
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
