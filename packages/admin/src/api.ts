const BASE = '/api/admin';

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
    },
  });
  return res;
}

async function jsonRequest(path: string, options: RequestInit = {}): Promise<Response> {
  return request(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export const api = {
  async login(email: string, password: string) {
    const res = await jsonRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    return res.json() as Promise<{ companyId: string; name: string }>;
  },

  async getSettings() {
    const res = await request('/settings');
    if (!res.ok) throw new Error('Failed to load settings');
    return res.json() as Promise<{ name: string; primaryColor: string; logoUrl: string | null }>;
  },

  async updateSettings(data: { primaryColor?: string }) {
    const res = await jsonRequest('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json() as Promise<{ success: boolean }>;
  },

  async uploadLogo(file: File) {
    const formData = new FormData();
    formData.append('logo', file);
    const res = await request('/logo', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload logo');
    return res.json() as Promise<{ logoUrl: string }>;
  },

  async getPricing() {
    const res = await request('/pricing');
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

  async updatePricing(overrides: Array<{
    materialKey: string;
    costLow?: number;
    costHigh?: number;
    pitchFlat?: number;
    pitchLow?: number;
    pitchMedium?: number;
    pitchSteep?: number;
  }>) {
    const res = await jsonRequest('/pricing', {
      method: 'PUT',
      body: JSON.stringify(overrides),
    });
    if (!res.ok) throw new Error('Failed to update pricing');
    return res.json() as Promise<{ success: boolean; count: number }>;
  },

  async getEmbedCode() {
    const res = await request('/embed-code');
    if (!res.ok) throw new Error('Failed to load embed code');
    return res.json() as Promise<{ embedCode: string }>;
  },

  async logout() {
    const res = await request('/logout', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to logout');
    return res.json() as Promise<{ success: boolean }>;
  },
};
