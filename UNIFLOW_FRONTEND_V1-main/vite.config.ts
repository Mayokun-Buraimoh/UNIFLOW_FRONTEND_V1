/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        // Legacy bundle can exceed Workbox default 2 MiB precache limit.
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
