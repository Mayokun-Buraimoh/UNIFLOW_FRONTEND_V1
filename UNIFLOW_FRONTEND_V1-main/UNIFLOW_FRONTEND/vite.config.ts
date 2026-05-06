/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

import { VitePWA } from 'vite-plugin-pwa';

/** Keep in sync with `src/utils/envGuards.ts` (Vite config cannot import from `src` composite overlap). */
function isTemplatedBackendUrl(url: string): boolean {
  const s = url.trim().toLowerCase();
  if (!s) return false;
  if (/\breplace[_-]?me\b/i.test(url)) return true;
  if (/\byour[_-]?subdomain\b/i.test(url)) return true;
  if (s.includes('changeme')) return true;
  if (s.includes('localhost') && s.includes('example')) return true;
  try {
    const host = new URL(s.includes('://') ? s : `https://${s}`).hostname.toLowerCase();
    if (host.startsWith('replace_me.') || host.startsWith('replace-me.')) return true;
    if (host.includes('replace_me') || host.includes('replace-me')) return true;
    if (host.startsWith('your_subdomain.') || host.startsWith('your-subdomain.')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function validateBackendEnvPlugin(): Plugin {
  return {
    name: 'uniflow-validate-backend-env',
    configResolved(config) {
      if (config.command !== 'build') return

      const vars = [
        ['VITE_BACKEND_URL', process.env.VITE_BACKEND_URL],
        ['VITE_API_URL', process.env.VITE_API_URL],
        ['VITE_FRONTEND_URL', process.env.VITE_FRONTEND_URL],
        ['VITE_DJANGO_API_URL', process.env.VITE_DJANGO_API_URL],
        ['VITE_AI_API_URL', process.env.VITE_AI_API_URL],
      ] as const

      for (const [name, value] of vars) {
        if (value?.trim() && isTemplatedBackendUrl(value)) {
          throw new Error(
            `[UniFlow] ${name}="${value.trim()}" is still a placeholder. ` +
              `Set your real ngrok forwarding URL (or LAN origin) in UNIFLOW_FRONTEND/.env, then rebuild.`
          )
        }
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    validateBackendEnvPlugin(),
    react(),
    legacy(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        // Our legacy bundle can exceed Workbox's default 2 MiB precache limit.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'UniFlow',
        short_name: 'UniFlow',
        description: 'UniFlow - A modern task and schedule management app',
        theme_color: '#4C6F59',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'assets/icons/Blue_File.png', /* Just using any existing icon layout */
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'assets/icons/Blue_File.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    include: ['@ionic/react', '@ionic/react-router', 'ionicons'],
    exclude: []
  },
  ssr: {
    noExternal: ['@ionic/react', '@ionic/react-router']
  },
  server: {
    port: 5173,
    host: true,
    open: true
  },
  preview: {
    port: 5173,
    host: true
  }
})
