import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [isSetup, setIsSetup] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('CyberSecResearch2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSetup) {
        await api.setupAdmin(username, password);
        // Automatically login after setup
        await api.login(username, password);
      } else {
        await api.login(username, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cyber-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-cyber-900 border border-cyber-800 rounded-xl p-8 shadow-2xl glow-cyan">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 mb-3">
            <Shield className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-wide text-slate-100 flex items-center gap-2">
            HA-FIM Control Plane
          </h1>
          <p className="text-xs text-slate-400 text-center mt-1">
            Hardware-Assisted File Integrity Monitoring System
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-500/15 border border-rose-500/40 rounded-lg text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Administrator Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-cyber-950 border border-cyber-700 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Secret Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-cyber-950 border border-cyber-700 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 mt-2 shadow-md hover:shadow-cyan-500/20 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : isSetup ? 'Initialize Admin & Enter' : 'Authenticate Session'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-cyber-800 text-center text-xs text-slate-500">
          <button
            type="button"
            onClick={() => { setIsSetup(!isSetup); setError(null); }}
            className="text-cyan-400 hover:underline"
          >
            {isSetup ? 'Switch to Login with Existing Admin' : 'First-time setup? Initialize new Admin'}
          </button>
        </div>
      </div>
    </div>
  );
};
