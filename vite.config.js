import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa'; // 👈 MAKE SURE THIS EXACT LINE IS HERE!

export default defineConfig({
  plugins: [
    react(),
    VitePWA({ // 👈 This is where it was crashing because it didn't know what VitePWA was
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'maskable-icon.png'],
      manifest: {
        name: 'Parivaar - Living Family Memories',
        short_name: 'Parivaar',
        description: 'Your family\'s private, secure sacred space to preserve legacies.',
        theme_color: '#1D9E75',
        background_color: '#fafafa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'maskable-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1.*/, 
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-data-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24
              },
              cacheableResponse: {
                statuses: [200]
              }
            }
          }
        ]
      }
    })
  ]
});