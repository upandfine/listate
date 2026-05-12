import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-Test-Setup (E5/E6 aus dem Backlog).
 *
 * Pure Playwright-Tests in TypeScript (kein BDD-Layer — playwright-bdd
 * war zum Setup-Zeitpunkt nicht mit der installierten Playwright-Version
 * kompatibel). Die Gherkin-Specs unter features/ bleiben als
 * Behavior-Doku; die Tests hier setzen die wichtigsten Szenarien als
 * pure Code um, in der gleichen Reihenfolge und mit den gleichen
 * Schritten wie in den .feature-Files.
 *
 * Eigene Test-DB (data/e2e-test.db) und eigener Port (3041), damit der
 * lokale Dev-Server nicht stoert. globalSetup raeumt die DB + og-images
 * vor jedem Run weg.
 */

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // SQLite ist single-writer
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3041',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      'DB_PATH=./data/e2e-test.db DEV_AUTH_BYPASS=true ' +
      'AUTH_SECRET=e2e-test-secret-not-for-production ' +
      'AUTH_TRUST_HOST=true ' +
      'NEXT_PUBLIC_BASE_URL=http://localhost:3041 ' +
      'PORT=3041 npm run dev',
    url: 'http://localhost:3041/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
