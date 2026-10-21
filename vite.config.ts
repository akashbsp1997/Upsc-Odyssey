import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['odyssey.svg'],
      manifest: {
        name: 'UPSC Odyssey',
        short_name: 'Odyssey',
        description: 'Offline-first UPSC Civil Services preparation RPG.',
        theme_color: '#111918',
        background_color: '#111918',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/odyssey.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});