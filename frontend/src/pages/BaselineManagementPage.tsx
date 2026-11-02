import React, { useState, useEffect } from 'react';
import {
  Database,
  PlusCircle,
  Clock,
  CheckCircle,
  FileText,
  ShieldCheck,
  RefreshCw,
  Lock,
  History,
  AlertCircle
} from 'lucide-react';
import { Baseline, BaselineEntry, BaselineApproval } from '../types';
import { api } from '../services/api';

export const BaselineManagementPage: React.FC = () => {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [approvals, setApprovals] = useState<BaselineApproval[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize modal
  const [showInitModal, setShowInitModal] = useState(false);
  const [initNotes, setInitNotes] = useState('');
  const [initializing, setInitializing] = useState(false);

  // Entries view modal
  const [selectedBaseline, setSelectedBaseline] = useState<Baseline | null>(null);
  const [entries, setEntries] = useState<BaselineEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bData, aData] = await Promise.all([
        api.getBaselines(),
        api.getApprovalHistory()
      ]);
      setBaselines(bData);
      setApprovals(aData);
    } catch (e) {
      console.error('Failed to load baseline data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setInitializing(true);
      const res = await api.initializeBaseline(initNotes);
      alert(`Baseline initialized successfully: Version ${res.version} generated and signed inside TEE memory.`);
      setShowInitModal(false);
      setInitNotes('');
      await loadData();
    } catch (e: any) {
      alert(`Baseline initialization rejected: ${e.message}`);
    } finally {
      setInitializing(false);
    }
  };

  const handleViewEntries = async (b: Baseline) => {
    setSelectedBaseline(b);
    try {
      setLoadingEntries(true);
      const data = await api.getBaselineEntries(b.id);
      setEntries(data);
    } catch (e: any) {
      alert(`Error loading entries: ${e.message}`);
    } finally {
      setLoadingEntries(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Authoritative Baseline Management
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically sealed golden state records isolated inside the Trusted Execution Environment
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowInitModal(true)}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Initialize New Baseline
          </button>
        </div>
      </div>

      {/* Security Assurance Notice */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4 flex items-start space-x-3">
        <Lock className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong>TEE Isolation Guarantee:</strong> The authoritative baseline is maintained inside the TEE enclave memory.
          Host operating system processes (even those with root privileges) cannot directly overwrite the baseline.
          Updates must be accompanied by an authenticated administrative signature with anti-replay monotonic counters.
        </div>
      </div>

      {/* Version History Table */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cyber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-200">Baseline Version History</h3>
          </div>
          <span className="text-xs text-slate-400">{baselines.length} total revisions recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-cyber-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-cyber-800">
              <tr>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Created At (UTC)</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Total Files</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Enclave Signature</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-800/60 font-mono text-[11px]">
              {loading && baselines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans text-xs">
                    Loading baselines...
                  </td>
                </tr>
              ) : baselines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans text-xs">
                    No baselines initialized yet. Click "Initialize New Baseline" to establish system ground truth.
                  </td>
                </tr>
              ) : (
                baselines.map((b) => (
                  <tr key={b.id} className="hover:bg-cyber-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-cyan-400 font-bold">v{b.version}</td>
                    <td className="px-4 py-2.5 text-slate-400">{new Date(b.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-slate-300 font-sans">{b.created_by}</td>
                    <td className="px-4 py-2.5 text-slate-300">{b.total_files} files</td>
                    <td className="px-4 py-2.5 font-sans">
                      {b.is_active ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3 h-3" /> ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-cyber-800 text-slate-400 border border-cyber-700 text-[10px]">
                          HISTORICAL
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 truncate max-w-[140px]" title={b.enclave_signature}>
                      {b.enclave_signature ? `${b.enclave_signature.slice(0, 10)}...${b.enclave_signature.slice(-8)}` : 'None'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      <button
                        onClick={() => handleViewEntries(b)}
                        className="px-2.5 py-1 rounded bg-cyber-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      >
                        Inspect Files
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Authorized Baseline Update Approvals History */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-cyber-800">
          <h3 className="text-sm font-semibold text-slate-200">Authorized Change Approvals Audit Trail</h3>
          <p className="text-xs text-slate-400">Granular single-file update authorizations approved by administrator</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-cyber-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-cyber-800">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">File Path</th>
                <th className="px-4 py-3">Approved New SHA-256</th>
                <th className="px-4 py-3">Approved By</th>
                <th className="px-4 py-3">Justification</th>
                <th className="px-4 py-3">Enclave Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-800/60 font-mono text-[11px]">
              {approvals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 font-sans text-xs">
                    No administrative baseline update approvals recorded.
                  </td>
                </tr>
              ) : (
                approvals.map((app) => (
                  <tr key={app.id} className="hover:bg-cyber-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400">{new Date(app.requested_at).toLocaleTimeString()}</td>
                    <td className="px-4 py-2.5 text-slate-200 truncate max-w-xs">{app.file_path}</td>
                    <td className="px-4 py-2.5 text-cyan-400 truncate max-w-[120px]" title={app.new_hash}>
                      {app.new_hash.slice(0, 10)}...{app.new_hash.slice(-6)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 font-sans">{app.approved_by || app.requested_by}</td>
                    <td className="px-4 py-2.5 text-slate-400 font-sans truncate max-w-xs">{app.reason || 'None'}</td>
                    <td className="px-4 py-2.5 text-slate-500 truncate max-w-[100px]" title={app.enclave_receipt}>
                      {app.enclave_receipt ? `${app.enclave_receipt.slice(0, 8)}...` : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Initialize Baseline Modal */}
      {showInitModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Initialize System Baseline
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This operation scans all files in approved monitoring roots, computes SHA-256 digests, and commits them as the authoritative ground truth inside the TEE comparison engine.
            </p>
            <form onSubmit={handleInitialize} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Baseline Revision Notes</label>
                <textarea
                  placeholder="e.g., Clean deployment of release 1.0.0"
                  value={initNotes}
                  onChange={(e) => setInitNotes(e.target.value)}
                  className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-2.5 text-slate-100 focus:border-cyan-400 focus:outline-none h-20"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-cyber-800">
                <button
                  type="button"
                  onClick={() => setShowInitModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={initializing}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {initializing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  {initializing ? 'Hashing & Initializing...' : 'Initialize Baseline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Baseline Entries Modal */}
      {selectedBaseline && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-cyber-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Baseline Revision: v{selectedBaseline.version}
                </h3>
                <span className="text-xs text-slate-400">{entries.length} sealed file records</span>
              </div>
              <button
                onClick={() => setSelectedBaseline(null)}
                className="px-3 py-1 rounded bg-cyber-800 hover:bg-cyber-700 text-slate-300 text-xs"
              >
                Close
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto overflow-x-auto">
              {loadingEntries ? (
                <div className="py-8 text-center text-slate-400 text-xs">Loading baseline records...</div>
              ) : (
                <table className="w-full text-left text-xs font-mono min-w-[500px]">
                  <thead className="bg-cyber-950 text-slate-400 uppercase font-semibold border-b border-cyber-800">
                    <tr>
                      <th className="px-3 py-2">Path</th>
                      <th className="px-3 py-2">SHA-256 Hash</th>
                      <th className="px-3 py-2">Perms</th>
                      <th className="px-3 py-2">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyber-800/60 text-[11px]">
                    {entries.map((e) => (
                      <tr key={e.id} className="hover:bg-cyber-800/30">
                        <td className="px-3 py-2 text-slate-200 truncate max-w-xs" title={e.file_path}>{e.file_path}</td>
                        <td className="px-3 py-2 text-emerald-400 truncate max-w-[140px]" title={e.sha256_hash}>
                          {e.sha256_hash.slice(0, 10)}...{e.sha256_hash.slice(-8)}
                        </td>
                        <td className="px-3 py-2 text-slate-400">{e.permissions}</td>
                        <td className="px-3 py-2 text-slate-400">{e.size_bytes}B</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
