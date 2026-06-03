/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { VitePWA } from 'vite-plugin-pwa';

/** ORT WASM is loaded from public/openwakeword/ort — do not emit 26MB hashed copies into dist/assets. */
function excludeBundledOrtWasm() {
  return {
    name: 'exclude-bundled-ort-wasm',
    generateBundle(_options: unknown, bundle: Record<string, unknown>) {
      for (const fileName of Object.keys(bundle)) {
        if (fileName.includes('ort-wasm') && fileName.endsWith('.wasm')) {
          delete bundle[fileName];
        }
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    target: 'es2020',
  },
  plugins: [
    react(),
    excludeBundledOrtWasm(),
    legacy({
      // onnxruntime-web uses BigInt literals; requires Chrome 67+ / Safari 14+.
      modernTargets: 'Chrome >= 67, Firefox >= 68, Safari >= 14, Edge >= 79, iOS >= 14, Android >= 67',
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        // Legacy bundle can exceed Workbox default 2 MiB precache limit.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Do not precache large/binary wake-word assets (served from public/ on demand).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}'],
        globIgnores: [
          '**/openwakeword/**',
          '**/models/**',
          '**/*ort-wasm*.wasm',
          '**/*.wasm',
          '**/*.onnx',
        ],
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
    include: [
      '@ionic/react',
      '@ionic/react-router',
      'ionicons',
      'openwakeword-wasm-browser',
    ],
    // Keep onnxruntime-web out of prebundle — it dynamic-imports wasm .mjs from public URLs.
    exclude: ['onnxruntime-web'],
  },
  ssr: {
    noExternal: ['@ionic/react', '@ionic/react-router']
  },
  server: {
    port: 5173,
    host: true,
    open: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    port: 5173,
    host: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
