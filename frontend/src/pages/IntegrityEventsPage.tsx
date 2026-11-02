import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  AlertOctagon,
  Clock,
  Shield,
  Activity,
  FileText
} from 'lucide-react';
import { IntegrityEvent } from '../types';
import { api } from '../services/api';

export const IntegrityEventsPage: React.FC = () => {
  const [events, setEvents] = useState<IntegrityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<IntegrityEvent | null>(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await api.getEvents({
        search: search || undefined,
        severity: severityFilter || undefined,
        event_type: typeFilter || undefined,
        status: statusFilter || undefined
      });
      setEvents(data);
    } catch (e) {
      console.error('Failed to load events', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [search, severityFilter, typeFilter, statusFilter]);

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const updated = await api.updateEventStatus(id, newStatus);
      setSelectedEvent(updated);
      await loadEvents();
    } catch (e: any) {
      alert(`Status update failed: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Integrity Violation Events
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically attested security incidents and filesystem anomalies
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href={api.getEventsExportUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-200 text-xs font-medium border border-cyber-700 flex items-center gap-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export Forensic CSV
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="relative sm:col-span-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Search path, uuid, or verdict..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-cyber-900 border border-cyber-800 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-cyber-900 border border-cyber-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-cyber-900 border border-cyber-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
        >
          <option value="">All Event Types</option>
          <option value="MODIFICATION">MODIFICATION</option>
          <option value="CREATION">CREATION</option>
          <option value="DELETION">DELETION</option>
          <option value="PERMISSION_CHANGE">PERMISSION_CHANGE</option>
          <option value="REPLAY_ATTACK">REPLAY_ATTACK</option>
          <option value="TEE_ERROR">TEE_ERROR</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-cyber-900 border border-cyber-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
        >
          <option value="">All Investigation Statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="INVESTIGATING">INVESTIGATING</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
        </select>
      </div>

      {/* Events Table */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[750px]">
            <thead className="bg-cyber-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-cyber-800">
              <tr>
                <th className="px-4 py-3">Timestamp (UTC)</th>
                <th className="px-4 py-3">File Path</th>
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">TEE Verdict</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyber-800/60 font-mono text-[11px]">
              {loading && events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans text-xs">
                    Loading integrity events...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans text-xs">
                    No security events recorded matching criteria.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-cyber-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400">
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-slate-200 font-medium truncate max-w-xs" title={evt.file_path}>
                      {evt.file_path}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">{evt.event_type}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        evt.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        evt.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {evt.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">{evt.tee_verdict}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded bg-cyber-800 text-slate-300 border border-cyber-700 text-[10px]">
                        {evt.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-sans">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="px-2.5 py-1 rounded bg-cyber-800 hover:bg-cyan-600/30 hover:text-cyan-300 text-slate-300 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Details Drawer/Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-cyber-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-rose-400" />
                  Security Incident: {selectedEvent.event_type}
                </h3>
                <span className="text-[11px] font-mono text-slate-400">UUID: {selectedEvent.event_uuid}</span>
              </div>
              <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                selectedEvent.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {selectedEvent.severity}
              </span>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-2.5 bg-cyber-950 rounded border border-cyber-800">
                <div className="text-slate-500 text-[10px] uppercase font-sans">Monitored File Path</div>
                <div className="text-slate-200 break-all">{selectedEvent.file_path}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-cyber-950 rounded border border-cyber-800">
                  <div className="text-slate-500 text-[10px] uppercase font-sans">Expected SHA-256 (TEE)</div>
                  <div className="text-emerald-400 break-all text-[10px]">
                    {selectedEvent.expected_hash || 'None (New file)'}
                  </div>
                </div>
                <div className="p-2.5 bg-cyber-950 rounded border border-cyber-800">
                  <div className="text-slate-500 text-[10px] uppercase font-sans">Observed SHA-256 (Disk)</div>
                  <div className="text-rose-400 break-all text-[10px]">
                    {selectedEvent.observed_hash || 'None (Deleted file)'}
                  </div>
                </div>
              </div>

              <div className="p-2.5 bg-cyber-950 rounded border border-cyber-800">
                <div className="text-slate-500 text-[10px] uppercase font-sans">TEE Cryptographic Enclave Receipt Signature</div>
                <div className="text-cyan-300 break-all text-[10px]">{selectedEvent.tee_receipt_sig || 'N/A'}</div>
                <div className="text-[10px] text-slate-500 mt-1 font-sans">
                  Anti-replay sequence number: <span className="font-mono text-slate-300">#{selectedEvent.tee_sequence || 'N/A'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-cyber-950 rounded border border-cyber-800">
                  <div className="text-slate-500 text-[10px] uppercase font-sans">Expected Perms</div>
                  <div className="text-slate-200">{selectedEvent.expected_permissions || 'N/A'}</div>
                </div>
                <div className="p-2 bg-cyber-950 rounded border border-cyber-800">
                  <div className="text-slate-500 text-[10px] uppercase font-sans">Observed Perms</div>
                  <div className="text-slate-200">{selectedEvent.observed_permissions || 'N/A'}</div>
                </div>
                <div className="p-2 bg-cyber-950 rounded border border-cyber-800">
                  <div className="text-slate-500 text-[10px] uppercase font-sans">Reporting Agent</div>
                  <div className="text-slate-200">{selectedEvent.source_agent}</div>
                </div>
              </div>
            </div>

            {/* Investigation Actions */}
            <div className="pt-3 border-t border-cyber-800 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 font-medium">Investigation Status:</span>
                <select
                  value={selectedEvent.status}
                  onChange={(e) => handleStatusChange(selectedEvent.id, e.target.value)}
                  className="bg-cyber-950 border border-cyber-700 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="INVESTIGATING">INVESTIGATING</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="FALSE_POSITIVE">FALSE_POSITIVE</option>
                </select>
              </div>

              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
