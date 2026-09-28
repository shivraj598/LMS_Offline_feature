import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The LMS backend (server/index.js) resolves download sources and proxies media.
const API_TARGET = process.env.LMS_API_URL || 'http://localhost:8787';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    // Allows testing real tenant subdomains locally: add
    //   127.0.0.1 tuitioncentre1.lms.local
    // to /etc/hosts and open http://tuitioncentre1.lms.local:5173
    allowedHosts: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Tuition Centre LMS',
        short_name: 'LMS',
        description: 'Watch your course videos online or offline.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Precache the React app shell so the LMS itself opens with no internet.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Catalog/API reads work offline from the last good response.
            urlPattern: /\/api\/(tenant|lessons)\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'lms-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Downloaded media lives in IndexedDB (not in the SW cache) on purpose:
        // it is user-managed, resumable and evictable from the Downloads screen.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
});
