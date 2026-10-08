import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// HTTPS=1 npm run dev: self-signed certificate, required for the camera (QR scan) on a phone over the local network
export default defineConfig({
  base: './',
  plugins: [
    preact(),
    ...(process.env.HTTPS ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Pick a name together',
        short_name: 'Pick a name',
        description: 'Pick a baby name together: each parent votes on their own, then you compare.',
        lang: 'en',
        theme_color: '#c2410c',
        background_color: '#fff8f1',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: { host: true },
});
