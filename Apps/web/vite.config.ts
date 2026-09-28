import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  // Match the API's default allowed origin; don't silently switch ports.
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@better-you/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@better-you/goals': path.resolve(__dirname, '../../services/goals/src/index.ts'),
    },
  },
});
