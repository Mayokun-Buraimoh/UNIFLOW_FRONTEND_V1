import { Capacitor } from '@capacitor/core';

/** Local UNIFLOW_BACKEND (default in `vite` dev). */
export const API_BASE_URL_LOCAL = 'http://localhost:3000/api';

/** Production Node backend origin (no path). Express mounts REST under `/api`. */
export const BACKEND_ORIGIN_PRODUCTION = 'https://uniflow-backend-v1.onrender.com';

/** Deployed API base (default in `vite build` / production / native). */
export const API_BASE_URL_PRODUCTION = `${BACKEND_ORIGIN_PRODUCTION}/api`;

/**
 * Optional Mac LAN host for physical iPhone (simulator can use localhost).
 * Example: VITE_DEV_MACHINE_HOST=192.168.1.112
 */
function resolveNativeLocalApiBase(): string {
  const host = (import.meta.env.VITE_DEV_MACHINE_HOST as string | undefined)?.trim();
  if (host) {
    const base = host.replace(/\/$/, '');
    return base.includes('/api') ? base : `${base}/api`;
  }
  return API_BASE_URL_LOCAL;
}

/** Resolved API base. `VITE_API_URL` wins when set. */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.replace(/\/$/, '');
  }

  // Capacitor iOS/Android: production builds default to Render unless local flags are set.
  if (Capacitor.isNativePlatform()) {
    const useLocal =
      import.meta.env.VITE_NATIVE_USE_LOCAL_API === 'true' ||
      import.meta.env.VITE_NATIVE_USE_LOCAL_API === '1';
    if (useLocal) {
      return resolveNativeLocalApiBase();
    }
    return API_BASE_URL_PRODUCTION;
  }

  return import.meta.env.PROD ? API_BASE_URL_PRODUCTION : API_BASE_URL_LOCAL;
}

/** True when the SPA is served from localhost (Vite dev / local preview). */
export function isLocalDevFrontend(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}
