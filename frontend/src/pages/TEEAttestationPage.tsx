import React, { useState, useEffect } from 'react';
import {
  Cpu,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Key,
  Binary,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileCode,
  Lock,
  ArrowRight
} from 'lucide-react';
import { TEEStatus, AttestationResult } from '../types';
import { api } from '../services/api';

export const TEEAttestationPage: React.FC = () => {
  const [teeStatus, setTeeStatus] = useState<TEEStatus | null>(null);
  const [attestation, setAttestation] = useState<AttestationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [customNonce, setCustomNonce] = useState('');

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await api.getTEEStatus();
      setTeeStatus(data);
    } catch (e) {
      console.error('Failed to load TEE status', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleVerifyAttestation = async () => {
    try {
      setVerifying(true);
      const res = await api.verifyAttestation(customNonce || undefined);
      setAttestation(res);
      await loadStatus();
    } catch (e: any) {
      alert(`Attestation validation failed: ${e.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      const res = await api.verifyTEEConnection();
      alert(`TEE Ping result: ${res.is_connected ? 'CONNECTED' : 'DISCONNECTED'}\nPlatform: ${res.platform}\nMode: ${res.mode}\nError: ${res.last_error || 'None'}`);
      await loadStatus();
    } catch (e: any) {
      alert(`Connection test error: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            Trusted Execution Environment (TEE) & Attestation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographic hardware isolation posture and AWS Nitro Enclaves measurement verification
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleTestConnection}
            className="px-3.5 py-2 rounded-lg bg-cyber-800 hover:bg-cyber-700 text-slate-200 text-xs font-medium border border-cyber-700 flex items-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            Probe Enclave Connection
          </button>
        </div>
      </div>

      {/* Prominent Warning Banner if running in Local Development Mode */}
      {teeStatus && !teeStatus.hardware_backed && (
        <div className="p-4 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-200 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <div className="font-semibold text-amber-300">
              SOFTWARE DEVELOPMENT EMULATION ACTIVE (NO HARDWARE ENCLAVE)
            </div>
            <p className="leading-relaxed">
              The system is currently running on standard Linux userspace memory without an active hardware-backed TEE (such as AWS Nitro Enclaves).
              While cryptographic hashing, HMAC token signing, and anti-replay counters are operational,
              <strong> this environment does NOT provide memory encryption or isolation against a compromised host kernel.</strong>
            </p>
          </div>
        </div>
      )}

      {/* Hardware TEE Banner if active */}
      {teeStatus && teeStatus.hardware_backed && (
        <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-200 flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <div className="font-semibold text-emerald-300">
              GENUINE AWS NITRO ENCLAVE HARDWARE ISOLATION ACTIVE
            </div>
            <p className="leading-relaxed">
              Comparison logic and authoritative file baseline records are sealed within dedicated CPU cores and encrypted memory allocations managed directly by the AWS Nitro hypervisor.
            </p>
          </div>
        </div>
      )}

      {/* TEE Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Platform Details */}
        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Target Platform</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-base font-bold text-slate-100">{teeStatus?.platform}</div>
          <div className="space-y-1.5 text-xs text-slate-400 font-mono">
            <div>Deployment: <span className="text-slate-200">{teeStatus?.mode}</span></div>
            <div>Enclave CID: <span className="text-slate-200">{teeStatus?.enclave_cid || 'N/A (Local)'}</span></div>
            <div>VSOCK Port: <span className="text-slate-200">{teeStatus?.enclave_port || '5000'}</span></div>
          </div>
        </div>

        {/* Remote Attestation Status */}
        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Attestation Verifier</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-slate-100 flex items-center gap-2">
            {teeStatus?.attestation_status === 'VERIFIED' ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> VERIFIED
              </span>
            ) : teeStatus?.attestation_status === 'SIMULATED' ? (
              <span className="text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> SIMULATED (DEV)
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" /> UNVERIFIED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Trust policy evaluates PCR0/1/2 against golden image measurements
          </p>
        </div>

        {/* Operational Statistics */}
        <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Enclave Operations</span>
            <Binary className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-base font-bold font-mono text-slate-100">
            {teeStatus?.total_verifications || 0} <span className="text-xs font-normal text-slate-400">verifications</span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-400 font-mono">
            <div>Security Rejections: <span className="text-rose-400">{teeStatus?.total_rejections || 0}</span></div>
            <div>Connection State: <span className="text-emerald-400">{teeStatus?.is_connected ? 'CONNECTED' : 'OFFLINE'}</span></div>
          </div>
        </div>
      </div>

      {/* Platform Configuration Registers (PCR Measurements) */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              Platform Configuration Registers (PCRs)
            </h3>
            <p className="text-xs text-slate-400">
              Cryptographic hashes of Enclave Image File (EIF) components measured at enclave boot
            </p>
          </div>
        </div>

        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 bg-cyber-950 rounded-lg border border-cyber-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-semibold text-[11px]">PCR0 — Enclave Image / Kernel / Boot RAM</span>
              <span className="text-[10px] text-slate-500 font-sans">SHA-384 / SHA-256</span>
            </div>
            <div className="text-cyan-300 break-all text-[11px]">
              {teeStatus?.measurements?.PCR0 || '0000000000000000000000000000000000000000000000000000000000000000'}
            </div>
          </div>

          <div className="p-3 bg-cyber-950 rounded-lg border border-cyber-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-semibold text-[11px]">PCR1 — Kernel OS / Init Modules</span>
              <span className="text-[10px] text-slate-500 font-sans">SHA-384 / SHA-256</span>
            </div>
            <div className="text-cyan-300 break-all text-[11px]">
              {teeStatus?.measurements?.PCR1 || '0000000000000000000000000000000000000000000000000000000000000000'}
            </div>
          </div>

          <div className="p-3 bg-cyber-950 rounded-lg border border-cyber-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-semibold text-[11px]">PCR2 — Enclave Application Binary</span>
              <span className="text-[10px] text-slate-500 font-sans">SHA-384 / SHA-256</span>
            </div>
            <div className="text-cyan-300 break-all text-[11px]">
              {teeStatus?.measurements?.PCR2 || '0000000000000000000000000000000000000000000000000000000000000000'}
            </div>
          </div>
        </div>
      </div>

      {/* Attestation Challenge & Trigger Box */}
      <div className="bg-cyber-900 border border-cyber-800 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Trigger Attestation Challenge</h3>
          <p className="text-xs text-slate-400">
            Sends an anti-replay cryptographic Nonce to the enclave and validates the returned attestation document.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Custom Nonce (Leave empty to generate cryptographically random 128-bit nonce)..."
            value={customNonce}
            onChange={(e) => setCustomNonce(e.target.value)}
            className="flex-1 bg-cyber-950 border border-cyber-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-cyan-400 focus:outline-none"
          />
          <button
            onClick={handleVerifyAttestation}
            disabled={verifying}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {verifying ? 'Verifying Attestation...' : 'Verify Remote Attestation'}
          </button>
        </div>

        {/* Attestation Result Outcome */}
        {attestation && (
          <div className="p-4 bg-cyber-950 rounded-lg border border-cyber-800 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-300 font-sans font-semibold">
              <span>Attestation Verification Outcome</span>
              <span className={attestation.is_valid ? 'text-emerald-400' : 'text-rose-400'}>
                {attestation.is_valid ? 'VALID EVIDENCE' : 'INVALID / SIMULATED'}
              </span>
            </div>
            <div>Signer Authority: <span className="text-slate-200">{attestation.signer_ca || 'N/A'}</span></div>
            <div>Challenge Nonce: <span className="text-cyan-300 break-all">{attestation.nonce}</span></div>
            <div>Trust Policy Result: <span className={attestation.trust_policy_satisfied ? 'text-emerald-400' : 'text-amber-400'}>
              {attestation.trust_policy_satisfied ? 'SATISFIED' : 'NOT SATISFIED'}
            </span></div>
            <div className="text-slate-400 font-sans text-[11px] pt-1">{attestation.details}</div>
          </div>
        )}
      </div>
    </div>
  );
};
