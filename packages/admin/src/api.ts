const BASE = '/api/admin';

let _csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  if (_csrfToken) return _csrfToken;
  const res = await fetch(`${BASE}/csrf-token`, { credentials: 'include' });
  if (!res.ok) return '';
  const data = await res.json() as { token: string };
  _csrfToken = data.token;
  return _csrfToken;
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
    },
  });

  // Global 401 interceptor: redirect to login on session expiry
  if (res.status === 401 && path !== '/login' && path !== '/setup' && path !== '/me' && path !== '/csrf-token') {
    window.location.replace('/admin');
  }

  return res;
}

async function jsonRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const extraHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Include X-CSRF-Token on state-changing requests (skip for login/setup — no session yet)
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && path !== '/login' && path !== '/setup') {
    const token = await fetchCsrfToken();
    if (token) {
      extraHeaders['X-CSRF-Token'] = token;
    }
  }

  return request(path, {
    ...options,
    headers: {
      ...extraHeaders,
      ...options.headers,
    },
  });
}

export interface Company {
  id: string;
  name: string;
  slug: string | null;
  email?: string;
  logoUrl: string | null;
  primaryColor: string;
  archivedAt?: string | null;
}

export interface Lead {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consentGiven: boolean;
  consentText: string | null;
  sqft: number;
  pitch: string;
  material: string;
  estimateLow: number;
  estimateHigh: number;
  address: string | null;
  createdAt: string;
}

export interface LeadsResponse {
  data: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Stats {
  totalLeads: number;
  totalEstimates: number;
  popularMaterial: string | null;
  averageSqft: number;
}

export const api = {
  async login(email: string, password: string) {
    const res = await jsonRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    return res.json() as Promise<{ companyId: string; name: string; role: 'super-admin' | 'company-admin' }>;
  },

  async logout() {
    const res = await jsonRequest('/logout', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to logout');
    // Clear cached CSRF token on logout
    _csrfToken = null;
    return res.json() as Promise<{ success: boolean }>;
  },

  // --- Company CRUD ---

  async listCompanies(opts?: { includeArchived?: boolean }) {
    const qs = opts?.includeArchived ? '?includeArchived=true' : '';
    const res = await request(`/companies${qs}`);
    if (!res.ok) throw new Error('Failed to load companies');
    const body = await res.json() as { data?: Company[] } | Company[];
    // Handle paginated response shape { data, total, page, pageSize }
    if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
      return body.data as Company[];
    }
    return body as Company[];
  },

  async createCompany(data: { name: string; email: string; slug?: string }) {
    const res = await jsonRequest('/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || 'Failed to create company');
    }
    return res.json() as Promise<{ id: string; name: string; slug: string }>;
  },

  async archiveCompany(companyId: string) {
    const res = await jsonRequest(`/companies/${companyId}/archive`, { method: 'PATCH' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || 'Failed to archive company');
    }
    return res.json() as Promise<{ success: boolean }>;
  },

  async restoreCompany(companyId: string) {
    const res = await jsonRequest(`/companies/${companyId}/restore`, { method: 'PATCH' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || 'Failed to restore company');
    }
    return res.json() as Promise<{ success: boolean }>;
  },

  async updateCompany(companyId: string, data: { name?: string; slug?: string }) {
    const res = await jsonRequest(`/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || 'Failed to update company');
    }
    return res.json() as Promise<{ success: boolean }>;
  },

  // --- Company-scoped settings ---

  async getCompanySettings(companyId: string) {
    const res = await request(`/companies/${companyId}/settings`);
    if (!res.ok) throw new Error('Failed to load settings');
    return res.json() as Promise<{ name: string; primaryColor: string; logoUrl: string | null; slug: string | null }>;
  },

  async updateCompanySettings(companyId: string, data: { primaryColor?: string }) {
    const res = await jsonRequest(`/companies/${companyId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json() as Promise<{ success: boolean }>;
  },

  async uploadCompanyLogo(companyId: string, file: File) {
    const formData = new FormData();
    formData.append('logo', file);
    const token = await fetchCsrfToken();
    const headers: Record<string, string> = {};
    if (token) headers['X-CSRF-Token'] = token;
    const res = await request(`/companies/${companyId}/logo`, {
      method: 'POST',
      body: formData,
      headers,
    });
    if (!res.ok) throw new Error('Failed to upload logo');
    return res.json() as Promise<{ logoUrl: string }>;
  },

  async getCompanyPricing(companyId: string) {
    const res = await request(`/companies/${companyId}/pricing`);
    if (!res.ok) throw new Error('Failed to load pricing');
    return res.json() as Promise<Array<{
      materialKey: string;
      costLow: number | null;
      costHigh: number | null;
      pitchFlat: number | null;
      pitchLow: number | null;
      pitchMedium: number | null;
      pitchSteep: number | null;
    }>>;
  },

  async updateCompanyPricing(companyId: string, overrides: Array<{
    materialKey: string;
    costLow?: number;
    costHigh?: number;
    pitchFlat?: number;
    pitchLow?: number;
    pitchMedium?: number;
    pitchSteep?: number;
  }>) {
    const res = await jsonRequest(`/companies/${companyId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify(overrides),
    });
    if (!res.ok) throw new Error('Failed to update pricing');
    return res.json() as Promise<{ success: boolean; count: number }>;
  },

  async checkSession(): Promise<{ companyId: string; role: 'super-admin' | 'company-admin'; name: string } | null> {
    const res = await request('/me');
    if (!res.ok) return null;
    return res.json() as Promise<{ companyId: string; role: 'super-admin' | 'company-admin'; name: string }>;
  },

  // --- Lead management ---

  async getLeads(companyId: string, params?: { search?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.pageSize != null) qs.set('pageSize', String(params.pageSize));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    const res = await request(`/companies/${companyId}/leads${query}`);
    if (!res.ok) throw new Error('Failed to load leads');
    return res.json() as Promise<LeadsResponse>;
  },

  async exportLeadsCsv(companyId: string, params?: { search?: string; from?: string; to?: string }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    const res = await request(`/companies/${companyId}/leads/csv${query}`);
    if (!res.ok) throw new Error('Failed to export leads');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${companyId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async getStats(companyId: string) {
    const res = await request(`/companies/${companyId}/stats`);
    if (!res.ok) throw new Error('Failed to load stats');
    return res.json() as Promise<Stats>;
  },
};
