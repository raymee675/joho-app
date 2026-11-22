import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const built = resolve('content/build/deck.json');
const deckPath = existsSync(built) ? built : resolve('sample/deck.json');

export default defineConfig({
  base: './',
  resolve: { alias: { '@deck': deckPath } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json}'] },
      manifest: {
        name: '古文・漢文 単語帳',
        short_name: '古文単語',
        display: 'standalone',
        start_url: './',
        background_color: '#fff8f1',
        theme_color: '#f26b0f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
