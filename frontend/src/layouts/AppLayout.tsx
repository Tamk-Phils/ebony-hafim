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
  X
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
        {/* Logo & Brand */}
        <div className="p-4 sm:p-5 border-b border-cyber-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wider text-slate-100 flex items-center gap-1.5">
                HA-FIM
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  TEE
                </span>
              </h1>
              <p className="text-xs text-slate-400">Hardware-Assisted FIM</p>
            </div>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-200 md:hidden rounded-lg hover:bg-cyber-800"
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
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-cyber-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer: Mode & User Info */}
      <div className="p-4 border-t border-cyber-800 bg-cyber-950/50 space-y-3">
        {/* TEE Mode Indicator */}
        <div className="p-2.5 rounded-lg border text-xs font-mono bg-cyber-900/80 border-cyber-700/60">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-400 uppercase">TEE Engine</span>
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
          <div className="truncate text-slate-300 text-[11px]">
            {teeStatus?.mode || 'CONNECTING...'}
          </div>
        </div>

        {/* User profile & logout */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2 text-xs text-slate-300">
            <div className="w-6 h-6 rounded-full bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center font-bold text-[10px] text-cyan-300">
              {admin?.username?.[0]?.toUpperCase() || 'A'}
            </div>
            <span className="font-mono truncate max-w-[100px]">{admin?.username || 'Admin'}</span>
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
    <div className="flex h-screen bg-cyber-950 text-slate-100 overflow-hidden font-sans">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Mobile Sliding Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-cyber-900 border-r border-cyber-800 flex flex-col justify-between z-50 transform transition-transform duration-300 ease-in-out md:hidden shadow-2xl ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderNavContent()}
      </div>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 bg-cyber-900 border-r border-cyber-800 flex-col justify-between z-20 shrink-0">
        {renderNavContent()}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-14 bg-cyber-900/90 backdrop-blur border-b border-cyber-800 flex items-center justify-between px-4 sm:px-6 z-10 shrink-0">
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 text-slate-400 hover:text-slate-100 md:hidden rounded-lg hover:bg-cyber-800 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 hidden sm:inline">
              System Control Plane
            </span>
            <div className="h-4 w-px bg-cyber-800 hidden sm:block" />
            <div className="flex items-center space-x-2 text-xs truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-300 font-mono truncate text-[11px] sm:text-xs">
                Agent: <span className="text-emerald-400">Active</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 text-xs shrink-0">
            {teeStatus && !teeStatus.hardware_backed && (
              <span className="px-2 sm:px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 font-medium text-[11px] sm:text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">Software Emulation (No HW TEE)</span>
                <span className="sm:hidden">Dev Mode</span>
              </span>
            )}
            {teeStatus?.hardware_backed && (
              <span className="px-2 sm:px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 font-medium text-[11px] sm:text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="hidden sm:inline">AWS Nitro Enclave Connected</span>
                <span className="sm:hidden">Enclave OK</span>
              </span>
            )}
            <button
              onClick={fetchTeeStatus}
              title="Refresh System Telemetry"
              className="p-1.5 rounded bg-cyber-800 hover:bg-cyber-700 text-slate-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Global Warning Banner for Software-Only Mode */}
        {teeStatus && !teeStatus.hardware_backed && (
          <div className="bg-amber-950/70 border-b border-amber-800/80 px-4 sm:px-6 py-2 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 shrink-0">
            <div className="flex items-center space-x-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate sm:whitespace-normal">
                <strong>DEVELOPMENT NOTICE:</strong> Running in software development mode (No hardware TEE).
              </span>
            </div>
            <button
              onClick={() => onNavigate('tee')}
              className="underline hover:text-white font-medium self-end sm:self-auto shrink-0 text-[11px]"
            >
              View TEE Details
            </button>
          </div>
        )}

        {/* Live Event Toast Banner */}
        {liveAlert && (
          <div className="bg-rose-950/90 border-b border-rose-800 px-4 sm:px-6 py-2.5 text-xs text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-fadeIn glow-danger shrink-0">
            <div className="flex items-center space-x-2 font-mono min-w-0">
              <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
              <span className="truncate">
                <strong>CRITICAL VIOLATION:</strong> {liveAlert.event_type} on {liveAlert.file_path} ({liveAlert.tee_verdict})
              </span>
            </div>
            <button
              onClick={() => onNavigate('events')}
              className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-sans text-xs self-end sm:self-auto shrink-0"
            >
              Investigate
            </button>
          </div>
        )}

        {/* Page Content Viewport with responsive padding */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-cyber-950">
          {children}
        </main>
      </div>
    </div>
  );
};
