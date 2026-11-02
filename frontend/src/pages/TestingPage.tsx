import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ShieldAlert,
  Search,
  Filter,
  ArrowRight
} from 'lucide-react';
import { TestResultItem } from '../types';
import { api } from '../services/api';

export const TestingPage: React.FC = () => {
  const [tests, setTests] = useState<TestResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState('');

  const loadTests = async () => {
    try {
      setLoading(true);
      const data = await api.getTests();
      setTests(data);
    } catch (e) {
      console.error('Failed to load test history', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTests();
  }, []);

  const handleRunTests = async () => {
    try {
      setRunning(true);
      const results = await api.runTests();
      setTests(results);
    } catch (e: any) {
      alert(`Test run failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const filteredTests = tests.filter((t) =>
    filter ? t.test_name.toLowerCase().includes(filter.toLowerCase()) : true
  );

  const passedCount = tests.filter((t) => t.status === 'PASSED').length;
  const failedCount = tests.filter((t) => t.status === 'FAILED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Automated Testing & Security Evaluation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Safe, controlled verification scenarios executed against dedicated sandbox targets
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleRunTests}
            disabled={running}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
          >
            {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            {running ? 'Executing 10 Scenarios...' : 'Run Automated Test Suite'}
          </button>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
        <div className="text-xs text-slate-300 leading-relaxed">
          <strong>Safe Sandbox Policy:</strong> Destructive mutations (file injection, deletion, permissions alterations, replay tokens) are strictly confined to the dedicated test sandbox directory. Arbitrary user or system files are never modified.
        </div>
      </div>

      {/* Test Execution Summary Stats */}
      {tests.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase">Total Tests Run</span>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-1">{tests.length}</div>
          </div>
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase">Passed Scenarios</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{passedCount}</div>
          </div>
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-4">
            <span className="text-xs font-semibold text-slate-400 uppercase">Failed Scenarios</span>
            <div className={`text-2xl font-bold font-mono mt-1 ${failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {failedCount}
            </div>
          </div>
        </div>
      )}

      {/* Search Filter */}
      <div className="flex items-center space-x-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
          <input
            type="text"
            placeholder="Filter test scenarios by name..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-cyber-900 border border-cyber-800 rounded-lg pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
          />
        </div>
      </div>

      {/* Tests Results List */}
      <div className="space-y-3">
        {loading && tests.length === 0 ? (
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-8 text-center text-slate-500 text-xs">
            Loading test scenarios...
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-8 text-center text-slate-500 text-xs">
            No test executions recorded yet. Click "Run Automated Test Suite" above to execute all 10 security scenarios.
          </div>
        ) : (
          filteredTests.map((test) => {
            const isPassed = test.status === 'PASSED';
            return (
              <div
                key={test.id}
                className={`bg-cyber-900 border rounded-xl p-4 transition-all ${
                  isPassed ? 'border-cyber-800 hover:border-cyber-700' : 'border-rose-800/80 bg-rose-950/20'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2.5">
                    {isPassed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <h3 className="text-sm font-semibold text-slate-100">{test.test_name}</h3>
                  </div>
                  <div className="flex items-center space-x-3 text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {test.latency_ms} ms
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {test.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-cyber-800/60 text-slate-400">
                  <div className="p-2 bg-cyber-950/70 rounded">
                    <span className="text-slate-500 text-[10px] uppercase font-sans block mb-0.5">Expected Outcome</span>
                    <span className="text-slate-200">{test.expected_outcome}</span>
                  </div>
                  <div className="p-2 bg-cyber-950/70 rounded">
                    <span className="text-slate-500 text-[10px] uppercase font-sans block mb-0.5">Actual Outcome</span>
                    <span className={isPassed ? 'text-emerald-300' : 'text-rose-300'}>{test.actual_outcome}</span>
                  </div>
                </div>

                {test.error_message && (
                  <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 text-xs">
                    {test.error_message}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
