import { getApiBaseUrl } from '../constants/apiBaseUrl';

// Environment configuration
export const config = {
  // Backend API URL (dev: localhost; prod / native: Render unless VITE_API_URL is set)
  API_BASE_URL: getApiBaseUrl(),
  
  // Frontend URL
  FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173',
  
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
