import {
  AdminProfile,
  DashboardSummary,
  MonitoredFile,
  MonitoringTarget,
  Baseline,
  BaselineEntry,
  BaselineApproval,
  IntegrityEvent,
  TEEStatus,
  AttestationResult,
  TestResultItem,
  BenchmarkResult,
  AuditLog
} from '../types';

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || '';
const API_BASE = (RAW_BASE ? RAW_BASE.replace(/\/$/, '') : '') + '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('hafim_token');
}

export function setToken(token: string): void {
  localStorage.setItem('hafim_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('hafim_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (res.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Session expired or unauthorized');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: async (username: string, password: string) => {
    const data = await request<{ access_token: string; username: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setToken(data.access_token);
    return data;
  },
  setupAdmin: async (username: string, password: string) => {
    return request<AdminProfile>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },
  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      clearToken();
    }
  },
  getMe: async () => request<AdminProfile>('/auth/me'),

  // Dashboard
  getSummary: async () => request<DashboardSummary>('/dashboard/summary'),
  getHealth: async () => request<any>('/dashboard/health'),

  // Monitored Files
  getFiles: async (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('integrity_status', status);
    return request<MonitoredFile[]>(`/monitored-files?${params.toString()}`);
  },
  getTargets: async () => request<MonitoringTarget[]>('/monitored-files/targets'),
  addTarget: async (path: string, is_recursive: boolean = true, description?: string) => {
    return request<MonitoringTarget>('/monitored-files/targets', {
      method: 'POST',
      body: JSON.stringify({ path, is_recursive, description })
    });
  },
  deleteTarget: async (id: number) => {
    return request<{ message: string }>(`/monitored-files/targets/${id}`, {
      method: 'DELETE'
    });
  },
  getFile: async (id: number) => request<MonitoredFile>(`/monitored-files/${id}`),
  verifyFile: async (id: number) => request<any>(`/monitored-files/${id}/verify`, { method: 'POST' }),
  triggerScan: async () => request<{ total: number; matched: number; violations: number }>('/monitored-files/scan', { method: 'POST' }),

  // Baselines
  getBaselines: async () => request<Baseline[]>('/baselines'),
  getBaselineEntries: async (id: number) => request<BaselineEntry[]>(`/baselines/${id}/entries`),
  initializeBaseline: async (notes?: string) => {
    return request<{ message: string; version: number }>('/baselines/initialize', {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
  },
  approveUpdate: async (file_path: string, new_hash: string, reason?: string) => {
    return request<{ message: string; file_path: string; new_hash: string }>('/baselines/approve-update', {
      method: 'POST',
      body: JSON.stringify({ file_path, new_hash, reason })
    });
  },
  getApprovalHistory: async () => request<BaselineApproval[]>('/baselines/approvals/history'),

  // Integrity Events
  getEvents: async (params?: { search?: string; severity?: string; event_type?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.severity) q.set('severity', params.severity);
    if (params?.event_type) q.set('event_type', params.event_type);
    if (params?.status) q.set('status', params.status);
    return request<IntegrityEvent[]>(`/events?${q.toString()}`);
  },
  getEvent: async (id: number) => request<IntegrityEvent>(`/events/${id}`),
  updateEventStatus: async (id: number, status: string) => {
    return request<IntegrityEvent>(`/events/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },
  getEventsExportUrl: () => `${API_BASE}/events/export`,

  // TEE
  getTEEStatus: async () => request<TEEStatus>('/tee/status'),
  verifyTEEConnection: async () => request<any>('/tee/verify-connection', { method: 'POST' }),
  verifyAttestation: async (nonce?: string) => {
    return request<AttestationResult>('/tee/attestation', {
      method: 'POST',
      body: JSON.stringify({ nonce })
    });
  },

  // Testing
  getTests: async () => request<TestResultItem[]>('/tests'),
  runTests: async () => request<TestResultItem[]>('/tests/run', { method: 'POST' }),

  // Evaluations
  getEvaluations: async () => request<BenchmarkResult[]>('/evaluations'),
  runBenchmark: async (num_files: number = 50, file_size_kb: number = 32) => {
    return request<BenchmarkResult>('/evaluations/run', {
      method: 'POST',
      body: JSON.stringify({ num_files, file_size_kb })
    });
  },
  getEvaluationsExportUrl: () => `${API_BASE}/evaluations/export`,

  // Audit Logs
  getAuditLogs: async () => request<AuditLog[]>('/audit-logs')
};
