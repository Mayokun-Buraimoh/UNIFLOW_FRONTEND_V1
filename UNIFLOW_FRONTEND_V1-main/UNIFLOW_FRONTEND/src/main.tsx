import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './i18n';

// Configure status bar for white background
if (typeof window !== 'undefined') {
  document.documentElement.classList.remove('ion-palette-dark');
  document.documentElement.style.colorScheme = 'light';
  try {
    localStorage.removeItem('uniflow_dark_mode');
  } catch {
    /* noop */
  }

  // Set status bar style for web
  document.documentElement.style.setProperty('--ion-statusbar-padding', 'env(safe-area-inset-top)');
  
  // Set meta tag for status bar style
  const metaTag = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (metaTag) {
    metaTag.setAttribute('content', 'default');
  }
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);