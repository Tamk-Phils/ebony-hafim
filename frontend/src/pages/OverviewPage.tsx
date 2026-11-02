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
  ArrowUpRight
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

  const loadSummary = async () => {
    try {
      setLoading(true);
      const data = await api.getSummary();
      setSummary(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard summary');
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
      alert(`Scan failed: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadSummary();
    const timer = setInterval(loadSummary, 10000);
    return () => clearInterval(timer);
  }, []);

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-cyan-400" />
        <span>Loading live system telemetry...</span>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300">
        <div className="font-semibold mb-1">Telemetry Retrieval Error</div>
        <div className="text-sm">{error}</div>
        <button
          onClick={loadSummary}
          className="mt-4 px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs"
        >
          Retry Connection
        </button>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Security Overview
            <span className="text-xs px-2 py-0.5 rounded bg-cyber-800 text-slate-400 font-mono font-normal">
              v{summary?.last_baseline_version ? `Baseline v${summary.last_baseline_version}` : 'Uninitialized'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time hardware-assisted integrity status and cloud enclave verification
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleTriggerScan}
            disabled={scanning}
            className="px-3.5 py-2 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-200 text-xs font-medium border border-cyber-700 flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin text-cyan-400' : ''}`} />
            {scanning ? 'Sweeping Target Roots...' : 'Trigger Integrity Scan'}
          </button>
          <button
            onClick={() => onNavigate('files')}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add Target
          </button>
        </div>
      </div>

      {/* Empty State when no monitored files */}
      {summary && summary.total_monitored_files === 0 ? (
        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-8 text-center max-w-xl mx-auto space-y-4 my-8">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-200">No Monitored Targets Configured</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              HA-FIM requires at least one approved monitoring root to compute authoritative baseline hashes inside the TEE.
            </p>
          </div>
          <button
            onClick={() => onNavigate('files')}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium inline-flex items-center gap-2"
          >
            Configure First Target Directory
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Monitored Files */}
            <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Monitored Targets</span>
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <FileCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {summary?.total_monitored_files || 0}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <span className="text-emerald-400 font-medium">{summary?.files_matching_baseline || 0}</span> matching baseline
                </div>
              </div>
            </div>

            {/* Integrity Violations */}
            <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Integrity Violations</span>
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
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
                    <span className="text-emerald-400 font-medium">All Files Clean</span>
                  )}
                </div>
              </div>
            </div>

            {/* Critical Open Alerts */}
            <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Open Critical Alerts</span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-amber-300">
                  {summary?.critical_events_count || 0}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  <span className="text-slate-300 font-medium">{summary?.high_events_count || 0}</span> high severity events
                </div>
              </div>
            </div>

            {/* TEE Deployment Mode */}
            <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">TEE Protected Boundary</span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <Cpu className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-sm font-bold font-mono text-purple-300 truncate">
                  {summary?.tee_hardware_backed ? 'AWS NITRO ENCLAVE' : 'SOFTWARE EMULATION'}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${summary?.tee_connection_status ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span>{summary?.tee_connection_status ? 'Enclave Connected' : 'Disconnected'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Chart & System Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart: Detection Activity */}
            <div className="lg:col-span-2 bg-cyber-900 border border-cyber-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Detection Activity by Event Type
                  </h3>
                  <p className="text-xs text-slate-400">Distribution of authenticated filesystem events recorded</p>
                </div>
                <button
                  onClick={() => onNavigate('events')}
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                >
                  View All Events <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary?.detection_activity_chart || []}>
                    <XAxis dataKey="type" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0b1325', borderColor: '#1e335f', borderRadius: '8px', fontSize: '12px' }}
                      itemStyle={{ color: '#06b6d4' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {(summary?.detection_activity_chart || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[entry.type] || '#06b6d4'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Side Status Card */}
            <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Telemetry & Timestamps
                </h3>
                <p className="text-xs text-slate-400 mb-4">Verification cycle health metrics</p>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-cyber-950/60 rounded-lg border border-cyber-800 flex items-center justify-between">
                    <span className="text-slate-400">Last Verification Sweep</span>
                    <span className="font-mono text-slate-200">
                      {summary?.last_scan_time ? new Date(summary.last_scan_time).toLocaleTimeString() : 'Never'}
                    </span>
                  </div>

                  <div className="p-3 bg-cyber-950/60 rounded-lg border border-cyber-800 flex items-center justify-between">
                    <span className="text-slate-400">Host Agent Mode</span>
                    <span className="font-mono text-emerald-400 font-semibold">{summary?.monitoring_agent_status || 'STANDBY'}</span>
                  </div>

                  <div className="p-3 bg-cyber-950/60 rounded-lg border border-cyber-800 flex items-center justify-between">
                    <span className="text-slate-400">Baseline Monotonic Version</span>
                    <span className="font-mono text-cyan-400 font-semibold">v{summary?.last_baseline_version || 0}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-cyber-950 rounded-lg border border-cyber-800 text-[11px] text-slate-400 leading-relaxed">
                <strong>Cryptographic Guarantee:</strong> Every verification verdict is signed with a monotonic sequence counter to prevent replay of clean state.
              </div>
            </div>
          </div>

          {/* Recent Security Events Table */}
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-cyber-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Recent Integrity Events</h3>
                <p className="text-xs text-slate-400">Authenticated event notifications stream</p>
              </div>
              <button
                onClick={() => onNavigate('events')}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
              >
                Inspect All <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="bg-cyber-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-cyber-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">File Path</th>
                    <th className="px-4 py-3">Event Type</th>
                    <th className="px-4 py-3">Severity</th>
                    <th className="px-4 py-3">Verdict</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyber-800/60 font-mono text-[11px]">
                  {(!summary?.recent_events || summary.recent_events.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500 font-sans text-xs">
                        No integrity violations detected. Filesystem is currently consistent with authoritative baseline.
                      </td>
                    </tr>
                  ) : (
                    summary.recent_events.map((evt) => (
                      <tr key={evt.id} className="hover:bg-cyber-800/30 transition-colors">
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
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            evt.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                            evt.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}>
                            {evt.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300">
                          {evt.tee_verdict}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded bg-cyber-800 text-slate-300 border border-cyber-700 text-[10px]">
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
        </>
      )}
    </div>
  );
};
