import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      // Bewusst nur die reinen Pure-Function-Helper. Alles, was fetch oder
      // die DB benötigt, kommt mit Integration-Tests dazu (BACKLOG Feature E).
      include: [
        'lib/slug.ts',
        'lib/tags.ts',
        'lib/ttl.ts',
        'lib/host.ts',
        'lib/safeRedirect.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
