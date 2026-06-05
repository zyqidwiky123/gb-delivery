import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'logo.webp'],
      manifest: {
        name: 'ARO DRIVE',
        short_name: 'ARO DRIVE',
        description: 'Pesan antar cepat di Blitar',
        id: '/',
        scope: '/',
        theme_color: '#CCFF00',
        background_color: '#0A0A0A',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,json,vue,txt,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 Days
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'framer-vendor': ['framer-motion'],
          'icons-vendor': ['lucide-react'],
          'ui-vendor': ['vaul'],
          'maps-vendor': ['@react-google-maps/api'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    // Strip console.log/warn from production builds automatically
    minify: 'esbuild',
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  server: {
    allowedHosts: true,
    host: true,
  },
})
