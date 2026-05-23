import { getApiBaseUrl } from '../constants/apiBaseUrl';

/** @deprecated Prefer getApiBaseUrl() — value can differ on web vs Capacitor. */
export const API_BASE_URL: string = getApiBaseUrl();

function buildUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function request(path: string, options: RequestInit = {}) {
  const apiUrl = getApiBaseUrl();

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('uniflow_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    cache: 'no-store',
    ...options,
    headers: {
      'Cache-Control': 'no-cache',
      ...headers,
    },
  });

  if (response.status === 304) {
    const cachedUser = localStorage.getItem('uniflow_user');
    if (cachedUser && path.includes('/auth/me')) {
      return JSON.parse(cachedUser);
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const message = text || `HTTP ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

export const api = {
  get: (path: string) => request(path, { method: 'GET' }),
  post: (path: string, body?: unknown) => request(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) => request(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: unknown) => request(path, { method: 'PUT', body: body != null ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
};


