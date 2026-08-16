import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@better-you/contracts': path.resolve(__dirname, 'packages/contracts/src/index.ts'),
      '@better-you/config': path.resolve(__dirname, 'packages/config/src/index.ts'),
      '@better-you/goals': path.resolve(__dirname, 'services/goals/src/index.ts'),
    },
  },
  test: {
    include: ['services/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
