import React, { useState } from 'react';
import { Shield, Lock, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [isSetup, setIsSetup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSetup) {
        await api.setupAdmin(username, password);
        await api.login(username, password);
      } else {
        await api.login(username, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = () => {
    setUsername('admin');
    setPassword('CyberSecResearch2026!');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-xl">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-sky-400 mb-3">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            HA-FIM Security Console
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Hardware-Assisted File Integrity Monitoring with Trusted Execution Environments
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter administrator username"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 font-mono transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-10 pr-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 font-mono transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 mt-2 shadow-sm disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : isSetup ? 'Initialize Admin & Sign In' : 'Sign In to Console'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo credentials hint */}
        <div className="mt-5 p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Demo Account: <code className="text-slate-300">admin</code></span>
          <button
            type="button"
            onClick={handleQuickDemoFill}
            className="text-sky-400 hover:text-sky-300 hover:underline font-medium"
          >
            Use Demo Login
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
          <button
            type="button"
            onClick={() => { setIsSetup(!isSetup); setError(null); }}
            className="text-sky-400 hover:underline"
          >
            {isSetup ? 'Switch to Standard Login' : 'Provision New Administrator Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};
