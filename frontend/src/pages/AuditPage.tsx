import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  Clock,
  Terminal,
  Server,
  Lock,
  User,
  Activity,
  HardDrive
} from 'lucide-react';
import { AuditLog } from '../types';
import { api } from '../services/api';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (e) {
      console.error('Failed to load audit logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
          Audit Logs & Security Configuration
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Immutable administrator operation logs, monitoring root constraints, and TEE parameters
        </p>
      </div>

      {/* System Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monitoring Engine Settings */}
        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2 border-b border-cyber-800 pb-2.5">
            <Server className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-200">Filesystem Monitoring Configuration</h3>
          </div>
          <div className="space-y-2 text-xs font-mono text-slate-300">
            <div className="flex justify-between py-1 border-b border-cyber-950">
              <span className="text-slate-400">Reconciliation Sweep Interval:</span>
              <span className="text-cyan-400">15 seconds</span>
            </div>
            <div className="flex justify-between py-1 border-b border-cyber-950">
              <span className="text-slate-400">Agent Heartbeat Liveness Threshold:</span>
              <span className="text-cyan-400">30 seconds</span>
            </div>
            <div className="flex justify-between py-1 border-b border-cyber-950">
              <span className="text-slate-400">Max Direct Hashing Buffer:</span>
              <span className="text-slate-200">100 MB</span>
            </div>
            <div className="flex justify-between py-1 border-b border-cyber-950">
              <span className="text-slate-400">Symlink Security Policy:</span>
              <span className="text-emerald-400">STRICT_CONTAINMENT (Traversals Blocked)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Linux Event Driver:</span>
              <span className="text-slate-200">libc inotify_init1 (Non-blocking)</span>
            </div>
          </div>
        </div>

        {/* TEE Cloud & Attestation Settings */}
        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2 border-b border-cyber-800 pb-2.5">
            <Lock className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-slate-200">TEE & Cryptographic Parameters</h3>
          </div>
          <div className="space-y-2 text-xs font-mono text-slate-300">
            <div className="flex justify-between py-1 border-b border-cyber-950">
              <span className="text-slate-400">Hashing Standard:</span>
              <span className="text-emerald-400">SHA-256 (FIPS 180-4)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-cyber-950">
              <span className="text-slate-400">Target TEE Architecture:</span>
              <span className="text-slate-200">AWS Nitro Enclaves (AF_VSOCK)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-cyber-950">
              <span className="text-slate-400">Attestation Root of Trust:</span>
              <span className="text-slate-200">AWS Nitro Enclaves PKI CA</span>
            </div>
            <div className="flex justify-between py-1 border-b border-cyber-950">
              <span className="text-slate-400">Anti-Replay Mechanism:</span>
              <span className="text-cyan-400">Monotonic Integer Sequence Validation</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Fail-Safe Policy:</span>
              <span className="text-rose-400">FAIL_CLOSED (No Silent Fallback)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Administrator Audit Logs Table */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cyber-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Privileged Operations Audit Log</h3>
            <p className="text-xs text-slate-400">Traceable ledger of all administrative events, baseline updates, and tests</p>
          </div>
          <span className="text-xs text-slate-400">{logs.length} audit entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-cyber-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-cyber-800">
              <tr>
                <th className="px-4 py-3">Timestamp (UTC)</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Source IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-800/60 font-mono text-[11px]">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans text-xs">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans text-xs">
                    No privileged actions recorded.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-cyber-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-cyan-300 font-semibold">{log.admin_username}</td>
                    <td className="px-4 py-2.5 text-slate-200 font-bold">{log.action}</td>
                    <td className="px-4 py-2.5 text-slate-300 truncate max-w-xs">{log.resource}</td>
                    <td className="px-4 py-2.5 text-slate-400 font-sans truncate max-w-md">{log.details || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{log.ip_address}</td>
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
