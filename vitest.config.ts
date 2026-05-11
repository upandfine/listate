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
      // Bewusst nur die Helper, fuer die wir aktiv Tests halten.
      // - Pure Functions: slug, tags, ttl, host, safeRedirect
      // - Mit In-Memory-DB: sparkline, clickStats
      // - Mit fetch-Mock: safeBrowsing, resolveTemplateUrl
      // - Mit fs-Mock: adultFilter
      // - Noch offen (kommen mit Integration-Tests in Schritt 4):
      //   createTrackingLink (orchestriert die obigen), generateId
      //   (braucht DB-Setup mit echtem getDb()).
      include: [
        'lib/slug.ts',
        'lib/tags.ts',
        'lib/ttl.ts',
        'lib/host.ts',
        'lib/safeRedirect.ts',
        'lib/sparkline.ts',
        'lib/clickStats.ts',
        'lib/safeBrowsing.ts',
        'lib/resolveTemplateUrl.ts',
        'lib/adultFilter.ts',
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
