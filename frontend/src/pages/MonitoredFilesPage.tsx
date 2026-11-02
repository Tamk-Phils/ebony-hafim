import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Search,
  Filter,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  CheckCircle,
  AlertTriangle,
  FolderPlus,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { MonitoredFile, MonitoringTarget } from '../types';
import { api } from '../services/api';

export const MonitoredFilesPage: React.FC = () => {
  const [files, setFiles] = useState<MonitoredFile[]>([]);
  const [targets, setTargets] = useState<MonitoringTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [newTargetPath, setNewTargetPath] = useState('');
  const [newTargetDesc, setNewTargetDesc] = useState('');
  const [isRecursive, setIsRecursive] = useState(true);
  
  const [selectedFile, setSelectedFile] = useState<MonitoredFile | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [updatingFile, setUpdatingFile] = useState<MonitoredFile | null>(null);
  const [updateReason, setUpdateReason] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [filesData, targetsData] = await Promise.all([
        api.getFiles(search || undefined, statusFilter || undefined),
        api.getTargets()
      ]);
      setFiles(filesData);
      setTargets(targetsData);
    } catch (e: any) {
      console.error('Error loading monitored files', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const handleAddTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addTarget(newTargetPath, isRecursive, newTargetDesc);
      setShowAddTarget(false);
      setNewTargetPath('');
      setNewTargetDesc('');
      await loadData();
    } catch (e: any) {
      alert(`Error adding target: ${e.message}`);
    }
  };

  const handleDeleteTarget = async (id: number) => {
    if (!confirm('Are you sure you want to remove this monitoring target root?')) return;
    try {
      await api.deleteTarget(id);
      await loadData();
    } catch (e: any) {
      alert(`Error removing target: ${e.message}`);
    }
  };

  const handleVerifyFile = async (id: number) => {
    try {
      setVerifyingId(id);
      const res = await api.verifyFile(id);
      alert(`TEE Verification Verdict for file: ${res.verdict}\nExpected Hash: ${res.expected_hash || 'N/A'}\nObserved Hash: ${res.observed_hash || 'N/A'}\nMode: ${res.mode_label}`);
      await loadData();
    } catch (e: any) {
      alert(`Verification error: ${e.message}`);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleApproveBaselineUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingFile || !updatingFile.last_observed_hash) return;
    try {
      await api.approveUpdate(updatingFile.file_path, updatingFile.last_observed_hash, updateReason);
      alert('Baseline entry updated successfully in TEE authoritative store.');
      setUpdatingFile(null);
      setUpdateReason('');
      await loadData();
    } catch (e: any) {
      alert(`Update rejected: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Monitored Target Files
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Filesystem objects actively hashed and cross-referenced against the TEE authoritative baseline
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddTarget(true)}
            className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Add Target Root
          </button>
        </div>
      </div>

      {/* Target Roots Management Box */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
          <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
          Active Monitored Root Directories ({targets.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {targets.map((t) => (
            <div key={t.id} className="p-3 bg-cyber-950/70 border border-cyber-800 rounded-lg flex items-center justify-between text-xs">
              <div className="truncate mr-2">
                <div className="font-mono text-slate-200 truncate font-medium">{t.path}</div>
                <div className="text-[11px] text-slate-400 truncate">{t.description || 'Monitored directory'}</div>
              </div>
              <button
                onClick={() => handleDeleteTarget(t.id)}
                title="Remove Root"
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {targets.length === 0 && (
            <div className="text-xs text-slate-500 py-1">No monitoring roots configured. Click "Add Target Root" above.</div>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search by file path or hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-cyber-900 border border-cyber-800 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-cyber-900 border border-cyber-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
        >
          <option value="">All Integrity Statuses</option>
          <option value="MATCH">Clean (MATCH)</option>
          <option value="TAMPERED">Tampered / Modified</option>
          <option value="NEW">New / Untracked</option>
          <option value="DELETED">Deleted</option>
          <option value="PERMISSION_CHANGED">Permission Changed</option>
          <option value="UNVERIFIED">Unverified</option>
        </select>
      </div>

      {/* Monitored Files Table */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-cyber-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-cyber-800">
              <tr>
                <th className="px-4 py-3">File Path</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expected SHA-256</th>
                <th className="px-4 py-3">Observed SHA-256</th>
                <th className="px-4 py-3">Perms</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Last Verified</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-800/60 font-mono text-[11px]">
              {loading && files.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans text-xs">
                    Loading monitored files...
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-sans text-xs">
                    No files found matching criteria.
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const isMatch = file.integrity_status === 'MATCH';
                  const isTampered = file.integrity_status === 'TAMPERED';
                  return (
                    <tr key={file.id} className="hover:bg-cyber-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-slate-200 font-medium truncate max-w-xs" title={file.file_path}>
                        {file.file_path}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isMatch ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                          isTampered ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {file.integrity_status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 truncate max-w-[120px]" title={file.expected_hash}>
                        {file.expected_hash ? `${file.expected_hash.slice(0, 8)}...${file.expected_hash.slice(-6)}` : 'N/A'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 truncate max-w-[120px]" title={file.last_observed_hash}>
                        {file.last_observed_hash ? `${file.last_observed_hash.slice(0, 8)}...${file.last_observed_hash.slice(-6)}` : 'N/A'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{file.permissions}</td>
                      <td className="px-4 py-2.5 text-slate-400">{(file.size_bytes / 1024).toFixed(1)} KB</td>
                      <td className="px-4 py-2.5 text-slate-400 font-sans text-[10px]">
                        {file.last_verified_at ? new Date(file.last_verified_at).toLocaleTimeString() : 'Pending'}
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-1 font-sans">
                        <button
                          onClick={() => handleVerifyFile(file.id)}
                          disabled={verifyingId === file.id}
                          title="Trigger TEE Verification"
                          className="p-1 rounded bg-cyber-800 hover:bg-cyan-500/20 hover:text-cyan-300 text-slate-400 transition-colors"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${verifyingId === file.id ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => setSelectedFile(file)}
                          title="Inspect File Details"
                          className="p-1 rounded bg-cyber-800 hover:bg-slate-700 text-slate-400 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {isTampered && (
                          <button
                            onClick={() => setUpdatingFile(file)}
                            title="Authorize New Baseline Hash"
                            className="p-1 rounded bg-cyan-600/30 text-cyan-300 hover:bg-cyan-600 hover:text-white border border-cyan-500/40 text-[10px] px-1.5 transition-colors"
                          >
                            Approve Update
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Target Modal */}
      {showAddTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-cyan-400" />
              Add Monitored Directory Root
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Directory must reside within administrator approved roots (e.g. sandbox directory).
            </p>
            <form onSubmit={handleAddTarget} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Directory Path</label>
                <input
                  type="text"
                  required
                  placeholder="/home/philding/Desktop/apps/ebony/sandbox"
                  value={newTargetPath}
                  onChange={(e) => setNewTargetPath(e.target.value)}
                  className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-2.5 text-slate-100 font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="System credentials & configs"
                  value={newTargetDesc}
                  onChange={(e) => setNewTargetDesc(e.target.value)}
                  className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-2.5 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="recursive"
                  checked={isRecursive}
                  onChange={(e) => setIsRecursive(e.target.checked)}
                  className="rounded bg-cyber-950 border-cyber-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="recursive" className="text-slate-300">Monitor subdirectories recursively</label>
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-cyber-800">
                <button
                  type="button"
                  onClick={() => setShowAddTarget(false)}
                  className="px-3 py-1.5 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                >
                  Register Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Detail Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 max-w-lg w-full shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-2 flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              File Inspection Record
            </h3>
            <div className="space-y-3 text-xs font-mono">
              <div className="p-2.5 bg-cyber-950 rounded border border-cyber-800">
                <div className="text-slate-500 text-[10px] uppercase font-sans">File Path</div>
                <div className="text-slate-200 break-all">{selectedFile.file_path}</div>
              </div>
              <div className="p-2.5 bg-cyber-950 rounded border border-cyber-800">
                <div className="text-slate-500 text-[10px] uppercase font-sans">Authoritative Expected SHA-256 (TEE Sealed)</div>
                <div className="text-emerald-400 break-all">{selectedFile.expected_hash || 'None'}</div>
              </div>
              <div className="p-2.5 bg-cyber-950 rounded border border-cyber-800">
                <div className="text-slate-500 text-[10px] uppercase font-sans">Last Observed SHA-256 (Host Filesystem)</div>
                <div className={`break-all ${selectedFile.expected_hash === selectedFile.last_observed_hash ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedFile.last_observed_hash || 'None (Deleted)'}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-cyber-950 rounded border border-cyber-800">
                  <div className="text-slate-500 text-[10px] uppercase font-sans">Permissions</div>
                  <div className="text-slate-200">{selectedFile.permissions}</div>
                </div>
                <div className="p-2 bg-cyber-950 rounded border border-cyber-800">
                  <div className="text-slate-500 text-[10px] uppercase font-sans">File Size</div>
                  <div className="text-slate-200">{selectedFile.size_bytes} bytes</div>
                </div>
                <div className="p-2 bg-cyber-950 rounded border border-cyber-800">
                  <div className="text-slate-500 text-[10px] uppercase font-sans">Baseline Ver.</div>
                  <div className="text-cyan-400">v{selectedFile.baseline_version}</div>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedFile(null)}
                className="px-4 py-1.5 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Baseline Update Modal */}
      {updatingFile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 mb-1 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              Authorize Baseline Hash Update
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              This action pushes the observed hash into the authoritative TEE baseline with an administrative cryptographic signature.
            </p>
            <form onSubmit={handleApproveBaselineUpdate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target File</label>
                <div className="p-2 bg-cyber-950 rounded border border-cyber-800 font-mono text-[11px] text-slate-200 truncate">
                  {updatingFile.file_path}
                </div>
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">New Authoritative SHA-256</label>
                <div className="p-2 bg-cyber-950 rounded border border-cyber-800 font-mono text-[10px] text-cyan-300 break-all">
                  {updatingFile.last_observed_hash}
                </div>
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Administrative Justification</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Authorized patch release 2.4.1"
                  value={updateReason}
                  onChange={(e) => setUpdateReason(e.target.value)}
                  className="w-full bg-cyber-950 border border-cyber-700 rounded-lg p-2.5 text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-cyber-800">
                <button
                  type="button"
                  onClick={() => setUpdatingFile(null)}
                  className="px-3 py-1.5 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-1.5"
                >
                  Sign & Commit to TEE
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
