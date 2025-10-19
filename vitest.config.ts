import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    env: loadEnv(mode, process.cwd(), ''),
    environmentMatchGlobs: [
      // Use jsdom for React component tests
      ['**/__tests__/app/**', 'jsdom'],
      ['**/__tests__/components/**', 'jsdom'],
    ],
    setupFiles: ['__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
}));
