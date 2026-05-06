import { Capacitor } from '@capacitor/core';
import { nativeBackendHostForStringRewrite, resolveApiBaseUrl } from '../constants/defaults';
import { ngrokSkipWarningHeaders } from '../utils/ngrokSkipWarning';

export const API_BASE_URL: string = resolveApiBaseUrl();

function rewriteLocalhostInString(value: string): string {
  const host = Capacitor.isNativePlatform() ? nativeBackendHostForStringRewrite() : undefined;
  if (!host) return value;
  return value.replace(/(https?:\/\/)localhost(?=[:/]|$)/g, `$1${host}`);
}

function rewriteLocalhostDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return rewriteLocalhostInString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteLocalhostDeep(item)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewriteLocalhostDeep(v);
    }
    return out as T;
  }
  return value;
}

function buildUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function request(path: string, options: RequestInit = {}) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('uniflow_token') : null;
  const url = buildUrl(path);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...ngrokSkipWarningHeaders(url),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const message = text || `HTTP ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    return rewriteLocalhostDeep(json);
  }
  const text = await response.text();
  return rewriteLocalhostInString(text);
}

export const api = {
  get: (path: string) => request(path, { method: 'GET' }),
  post: (path: string, body?: unknown) => request(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) => request(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: unknown) => request(path, { method: 'PUT', body: body != null ? JSON.stringify(body) : undefined }),
  delete: (path: string, body?: unknown) =>
    request(path, {
      method: 'DELETE',
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    }),
};


