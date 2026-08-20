import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@better-you/contracts': path.resolve(__dirname, 'packages/contracts/src/index.ts'),
      '@better-you/config': path.resolve(__dirname, 'packages/config/src/index.ts'),
      '@better-you/goals': path.resolve(__dirname, 'services/goals/src/index.ts'),
      '@better-you/auth': path.resolve(__dirname, 'services/auth/src/index.ts'),
      '@better-you/profile': path.resolve(__dirname, 'services/profile/src/index.ts'),
      '@better-you/onboarding': path.resolve(__dirname, 'services/onboarding/src/index.ts'),
      '@better-you/dashboard': path.resolve(__dirname, 'services/dashboard/src/index.ts'),
      '@better-you/check-ins': path.resolve(__dirname, 'services/check-ins/src/index.ts'),
      '@better-you/api': path.resolve(__dirname, 'apps/api/src/server.ts'),
    },
  },
  test: {
    include: ['services/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
