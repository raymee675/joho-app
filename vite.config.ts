import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const built = resolve('content/build/deck.json');
const deckPath = process.env.JOHO_DECK_PATH ? resolve(process.env.JOHO_DECK_PATH) : existsSync(built) ? built : resolve('sample/deck.json');

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
        name: '情報I 一問一答',
        short_name: '情報I',
        display: 'standalone',
        start_url: './',
        background_color: '#f8fafc',
        theme_color: '#2563eb',
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
