import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['app-icon.svg'],
    manifest: {
      name: 'STM32 系统学习平台',
      short_name: 'STM32 学习',
      lang: 'zh-CN',
      start_url: '.',
      display: 'standalone',
      background_color: '#f4f7fb',
      theme_color: '#164e63',
      icons: [{
        src: 'app-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      }],
    },
    workbox: {
      globPatterns: ['**/*.{html,js,css,json,md,svg,woff2}'],
      cleanupOutdatedCaches: true,
      navigateFallback: 'index.html',
    },
  })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
  },
});
