import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({ disable: true })],
  test: {
    environment: 'jsdom',
    setupFiles: ['./web/src/test/setup.ts'],
    include: ['./web/src/**/*.test.{ts,tsx}', './scripts/**/*.test.ts'],
  },
});
