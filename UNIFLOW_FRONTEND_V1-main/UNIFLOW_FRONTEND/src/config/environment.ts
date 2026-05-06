import { DEFAULT_BACKEND_BASE_URL, resolveApiBaseUrl } from '../constants/defaults';

// Environment configuration
export const config = {
  // Backend API URL
  API_BASE_URL: resolveApiBaseUrl(),

  // Frontend URL (Vite / ngrok — OAuth return, deep links)
  FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL || DEFAULT_BACKEND_BASE_URL,
  
  // Environment
  NODE_ENV: import.meta.env.MODE || 'development',
  
  // Feature flags
  ENABLE_GOOGLE_OAUTH: true,
  ENABLE_APPLE_OAUTH: false,
  
  // API endpoints
  ENDPOINTS: {
    HEALTH: '/health',
    AUTH: {
      REGISTER: '/auth/register',
      LOGIN: '/auth/login',
      ME: '/auth/me',
      CHANGE_PASSWORD: '/auth/change-password',
      GOOGLE: '/auth/google',
      GOOGLE_CALLBACK: '/auth/google/callback',
    },
    USERS: {
      ME: '/users/me',
      ALL: '/users/',
    },
    PROFILES: {
      GET: '/profiles/',
      UPDATE: '/profiles/',
      NOTIFICATIONS: '/profiles/notifications',
      STUDY_GOALS: '/profiles/study-goals',
      PREFERENCES: '/profiles/preferences',
    },
    TASKS: {
      ALL: '/tasks/',
      STATS: '/tasks/stats',
      BY_ID: '/tasks/:id',
      TOGGLE: '/tasks/:id/toggle',
    },
  },
};

export default config;
