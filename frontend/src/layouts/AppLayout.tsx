import React, { useState, useEffect } from 'react';
import {
  Shield,
  FileCheck,
  AlertTriangle,
  Database,
  Cpu,
  FlaskConical,
  BarChart3,
  Sliders,
  LogOut,
  Bell,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Terminal,
  Server,
  Menu,
  X,
  HardDrive
} from 'lucide-react';
import { TEEStatus, AdminProfile, IntegrityEvent } from '../types';
import { api } from '../services/api';

interface AppLayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  admin: AdminProfile | null;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentPage,
  onNavigate,
  onLogout,
  admin,
  children
}) => {
  const [teeStatus, setTeeStatus] = useState<TEEStatus | null>(null);
  const [liveAlert, setLiveAlert] = useState<IntegrityEvent | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchTeeStatus = async () => {
    try {
      const stat = await api.getTEEStatus();
      setTeeStatus(stat);
    } catch (e) {
      console.error('Failed to load TEE status', e);
    }
  };

  useEffect(() => {
    fetchTeeStatus();
    const interval = setInterval(fetchTeeStatus, 15000);

    // WebSocket listener for live events
    const customApiUrl = import.meta.env.VITE_API_BASE_URL;
    let wsUrl: string;
    if (customApiUrl) {
      try {
        const parsed = new URL(customApiUrl, window.location.href);
        const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${wsProtocol}//${parsed.host}/ws/events`;
      } catch {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws/events`;
      }
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws/events`;
    }
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'INTEGRITY_EVENT') {
            setLiveAlert(msg.data);
            setTimeout(() => setLiveAlert(null), 8000);
          }
        } catch (e) {
          console.error('WS parse error', e);
        }
      };
    } catch (e) {
      console.error('WS connect error', e);
    }

    return () => {
      clearInterval(interval);
      if (ws) ws.close();
    };
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: Shield },
    { id: 'files', label: 'Monitored Files', icon: FileCheck },
    { id: 'events', label: 'Integrity Events', icon: AlertTriangle },
    { id: 'baselines', label: 'Baseline Management', icon: Database },
    { id: 'tee', label: 'TEE & Attestation', icon: Cpu },
    { id: 'testing', label: 'Testing & Verification', icon: FlaskConical },
    { id: 'performance', label: 'Performance Benchmarks', icon: BarChart3 },
    { id: 'audit', label: 'Audit & Configuration', icon: Sliders },
  ];

  const handleNavClick = (id: string) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const renderNavContent = () => (
    <>
      <div>
        {/* Enterprise Brand Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold tracking-tight text-slate-100">
                  HA-FIM
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-sky-400 border border-slate-700">
                  TEE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Hardware-Assisted FIM</p>
            </div>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-200 md:hidden rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-sky-400 border border-slate-700 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer: TEE Status & User */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-900/60 space-y-2.5">
        {/* TEE Enclave Status Widget */}
        <div className="p-2.5 rounded-lg border text-xs font-mono bg-slate-950/70 border-slate-800">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-slate-400 uppercase tracking-wider">TEE Boundary</span>
            {teeStatus?.hardware_backed ? (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> HARDWARE
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 font-semibold">
                <AlertOctagon className="w-3 h-3" /> DEV MODE
              </span>
            )}
          </div>
          <div className="truncate text-slate-300 text-[11px] font-medium">
            {teeStatus?.mode || 'CONNECTING...'}
          </div>
        </div>

        {/* User Profile & Sign Out */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2 text-xs text-slate-300">
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-sky-400">
              {admin?.username?.[0]?.toUpperCase() || 'A'}
            </div>
            <span className="font-mono truncate max-w-[110px]">{admin?.username || 'Admin'}</span>
          </div>
          <button
            onClick={onLogout}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Mobile Sliding Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between z-50 transform transition-transform duration-300 ease-in-out md:hidden shadow-2xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderNavContent()}
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col justify-between z-20 shrink-0">
        {renderNavContent()}
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-14 bg-slate-900/95 backdrop-blur border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 z-10 shrink-0">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 text-slate-400 hover:text-slate-100 md:hidden rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="text-xs font-semibold text-slate-400 hidden sm:inline tracking-wider uppercase">
              Operations Center
            </span>
            <div className="h-4 w-px bg-slate-800 hidden sm:block" />
            <div className="flex items-center space-x-2 text-xs truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-300 font-mono truncate text-[11px] sm:text-xs">
                Agent: <span className="text-emerald-400 font-medium">Monitoring</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 text-xs shrink-0">
            {teeStatus && !teeStatus.hardware_backed && (
              <span className="px-2 sm:px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1.5 font-medium text-[11px] sm:text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Software Development Emulation</span>
                <span className="sm:hidden">Dev Mode</span>
              </span>
            )}
            {teeStatus?.hardware_backed && (
              <span className="px-2 sm:px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1.5 font-medium text-[11px] sm:text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">AWS Nitro Enclave Active</span>
                <span className="sm:hidden">Enclave OK</span>
              </span>
            )}
            <button
              onClick={fetchTeeStatus}
              title="Refresh Telemetry"
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Development Notice Banner */}
        {teeStatus && !teeStatus.hardware_backed && (
          <div className="bg-amber-950/40 border-b border-amber-900/50 px-4 sm:px-6 py-2 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 shrink-0">
            <div className="flex items-center space-x-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate sm:whitespace-normal text-[11px]">
                <strong>EMULATION NOTICE:</strong> Running in software development mode without physical TEE memory isolation.
              </span>
            </div>
            <button
              onClick={() => onNavigate('tee')}
              className="underline hover:text-white font-medium self-end sm:self-auto shrink-0 text-[11px]"
            >
              Hardware TEE Details
            </button>
          </div>
        )}

        {/* Live Integrity Event Alert Banner */}
        {liveAlert && (
          <div className="bg-rose-950/60 border-b border-rose-800 px-4 sm:px-6 py-2.5 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fadeIn shrink-0">
            <div className="flex items-center space-x-2 font-mono min-w-0">
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">
                <strong>INTEGRITY VIOLATION:</strong> {liveAlert.event_type} on {liveAlert.file_path} ({liveAlert.tee_verdict})
              </span>
            </div>
            <button
              onClick={() => onNavigate('events')}
              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-sans text-xs self-end sm:self-auto shrink-0 shadow-sm"
            >
              Investigate
            </button>
          </div>
        )}

        {/* Main Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
};
