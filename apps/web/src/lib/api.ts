const getApiUrl = () => {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  // If local development on port 3000, talk directly to backend on 3001
  if (window.location.port === '3000') {
    return `http://${window.location.hostname}:3001`;
  }
  // Otherwise, use relative path (e.g. VPS reverse proxied path)
  return '';
};

const API_URL = getApiUrl();

interface FetchOptions extends RequestInit {
  token?: string;
}

async function fetchApi<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOpts } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOpts,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    fetchApi<{ success: boolean; data: { accessToken: string; user: { email: string; name: string } } }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: (token: string) =>
    fetchApi<{ success: boolean; data: { email: string; name: string } }>('/api/auth/me', { token }),

  // Calls
  makeCall: (token: string, toNumber: string, prompt: string, voiceId?: string) =>
    fetchApi<{ success: boolean; data: { callId: string; status: string } }>('/api/calls', {
      method: 'POST',
      token,
      body: JSON.stringify({ toNumber, prompt, voiceId }),
    }),

  getCalls: (token: string) =>
    fetchApi<{ success: boolean; data: any[] }>('/api/calls', { token }),

  getCall: (token: string, id: string) =>
    fetchApi<{ success: boolean; data: any }>(`/api/calls/${id}`, { token }),

  getActiveCall: (token: string) =>
    fetchApi<{ success: boolean; data: any }>('/api/calls/active', { token }),

  endCall: (token: string, id: string) =>
    fetchApi<{ success: boolean }>(`/api/calls/${id}/end`, { method: 'POST', token }),

  getStats: (token: string) =>
    fetchApi<{ success: boolean; data: any }>('/api/stats', { token }),

  // Prompts
  getPrompts: (token: string) =>
    fetchApi<{ success: boolean; data: any[] }>('/api/prompts', { token }),

  createPrompt: (token: string, data: any) =>
    fetchApi<{ success: boolean; data: any }>('/api/prompts', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),

  updatePrompt: (token: string, id: string, data: any) =>
    fetchApi<{ success: boolean; data: any }>(`/api/prompts/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(data),
    }),

  deletePrompt: (token: string, id: string) =>
    fetchApi<{ success: boolean }>(`/api/prompts/${id}`, { method: 'DELETE', token }),

  // Settings
  getProviderStatus: (token: string) =>
    fetchApi<{ success: boolean; data: any[] }>('/api/settings/status', { token }),
};
