import React, { useState, useEffect } from 'react';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { MonitoredFilesPage } from './pages/MonitoredFilesPage';
import { IntegrityEventsPage } from './pages/IntegrityEventsPage';
import { BaselineManagementPage } from './pages/BaselineManagementPage';
import { TEEAttestationPage } from './pages/TEEAttestationPage';
import { TestingPage } from './pages/TestingPage';
import { PerformancePage } from './pages/PerformancePage';
import { AuditPage } from './pages/AuditPage';
import { AdminProfile } from './types';
import { api, isAuthenticated, clearToken } from './services/api';

export const App: React.FC = () => {
  const [authed, setAuthed] = useState<boolean>(isAuthenticated());
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    if (!isAuthenticated()) {
      setAuthed(false);
      setAdmin(null);
      setLoading(false);
      return;
    }

    try {
      const profile = await api.getMe();
      setAdmin(profile);
      setAuthed(true);
    } catch (e) {
      clearToken();
      setAuthed(false);
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLoginSuccess = async () => {
    setLoading(true);
    await checkAuth();
  };

  const handleLogout = async () => {
    await api.logout();
    setAuthed(false);
    setAdmin(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-950 flex items-center justify-center text-slate-400 text-sm font-mono">
        Authenticating HA-FIM Control Session...
      </div>
    );
  }

  if (!authed) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <AppLayout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      onLogout={handleLogout}
      admin={admin}
    >
      {currentPage === 'dashboard' && <OverviewPage onNavigate={setCurrentPage} />}
      {currentPage === 'files' && <MonitoredFilesPage />}
      {currentPage === 'events' && <IntegrityEventsPage />}
      {currentPage === 'baselines' && <BaselineManagementPage />}
      {currentPage === 'tee' && <TEEAttestationPage />}
      {currentPage === 'testing' && <TestingPage />}
      {currentPage === 'performance' && <PerformancePage />}
      {currentPage === 'audit' && <AuditPage />}
    </AppLayout>
  );
};
