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
      // Bewusst nur die Stellen, fuer die wir aktiv Tests halten:
      // - lib/*-Helper: Pure Functions, fetch/fs-Mocks, In-Memory-DB.
      // - app/actions.ts: Server-Actions (mit Auth/Redirect/Cache-Mocks).
      // - app/api/{create,links,export,health}/route.ts: API-Routes.
      // Noch offen: generateId (braucht echten getDb()-Setup),
      // app/auth-actions.ts, app/admin/* (UI-Routen).
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
        'lib/createTrackingLink.ts',
        'app/actions.ts',
        'app/api/create/route.ts',
        'app/api/links/route.ts',
        'app/api/export/route.ts',
        'app/api/health/route.ts',
      ],
      thresholds: {
        // Branches absichtlich etwas niedriger: viele Defensive-Pfade
        // (catch-Fallbacks fuer non-Error-Throw, unreachable
        // URL-Parse-Catches nach Regex-Vorpruefung) sind nicht ohne
        // Test-Doping erreichbar. Wir wollen einen scharfen aber
        // pragmatischen Wert.
        lines: 90,
        functions: 90,
        branches: 88,
        statements: 90,
      },
    },
  },
});
