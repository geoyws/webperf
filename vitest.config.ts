import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    // Use vmThreads pool for stability, enable parallelism
    pool: 'vmThreads',
    poolOptions: {
      vmThreads: {
        // Use available cores
        maxThreads: undefined, // auto-detect
        minThreads: 1,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'results/**',
        '**/*.test.ts',
        'vitest.config.ts',
        'config.example.ts',
      ],
    },
    testTimeout: 30000,
  },
});

