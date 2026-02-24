import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['src/__tests__/input.test.js', 'jsdom'],
      ['src/__tests__/leaderboard-storage.test.js', 'jsdom'],
      ['src/__tests__/initials-submit.test.js', 'jsdom'],
    ],
    include: ['src/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**'],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
      thresholds: { lines: 80 },
    },
  },
});
