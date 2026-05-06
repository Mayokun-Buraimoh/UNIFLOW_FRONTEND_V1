/** Local UNIFLOW_BACKEND (default in `vite` dev). */
export const API_BASE_URL_LOCAL = 'http://localhost:3000/api';

/** Production Node backend origin (no path). Express mounts REST under `/api`. */
export const BACKEND_ORIGIN_PRODUCTION = 'https://uniflow-backend-mdo3.onrender.com';

/** Deployed API base (default in `vite build` / production / native). */
export const API_BASE_URL_PRODUCTION = `${BACKEND_ORIGIN_PRODUCTION}/api`;

/** Resolved API base. `VITE_API_URL` wins when set. */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.replace(/\/$/, '');
  }
  return import.meta.env.PROD ? API_BASE_URL_PRODUCTION : API_BASE_URL_LOCAL;
}
