import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    hookTimeout: 60000,
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    env: {
      USE_PGLITE: 'false',
      IS_PG_TEST: 'true',
    },
    include: ['src/test/pg-concurrency.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
