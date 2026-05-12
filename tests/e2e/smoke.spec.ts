/**
 * E2E-Smoke-Tests fuer die Listate-Hauptpfade.
 *
 * Korrespondiert lose zu folgenden Gherkin-Specs:
 *   features/auth.feature       — Login per Dev-Bypass
 *   features/create-link.feature — Tracking-Link erzeugen
 *   features/dashboard.feature   — Dashboard zeigt eigene Links
 *   features/tracking.feature    — /t/<id> redirected
 *   features/account.feature     — Settings + Export-Block
 *
 * Vollstaendige BDD-Automatisierung mit Cucumber wartet, bis
 * playwright-bdd mit der aktuellen Playwright-Version kompatibel ist
 * (siehe Backlog E5/E6).
 */
import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: Dev-Bypass-Login
// ---------------------------------------------------------------------------

async function loginAsDevUser(page: import('@playwright/test').Page) {
  await page.goto('/login');
  // Der Dev-Bypass-Button hat das Label „Als dev@listate.local einloggen"
  // (siehe app/login/page.tsx). Nur sichtbar wenn isDevBypassEnabled.
  await page.getByRole('button', { name: /dev@listate\.local einloggen/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Listate-Smoke', () => {
  test('Health-Endpoint antwortet mit status=ok', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
  });

  test('Landing-Page laedt', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Listate/i }).first()).toBeVisible();
  });

  test('Login per Dev-Bypass und Dashboard erreichbar', async ({ page }) => {
    await loginAsDevUser(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('Tracking-Link aus dem Neu-Formular erstellen', async ({ page }) => {
    await loginAsDevUser(page);
    await page.goto('/');

    await page.getByLabel(/Original-URL/i).fill('example.com');
    await page.getByRole('button', { name: 'Erzeugen' }).click();

    // Erfolgs-Card erscheint mit "Tracking-Link"-Header + Tracking-URL.
    await expect(page.locator('code', { hasText: /\/t\// })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('Settings-Seite zeigt Datenexport-Block', async ({ page }) => {
    await loginAsDevUser(page);
    await page.goto('/settings');
    await expect(page.getByText(/Datenexport/i)).toBeVisible();
  });

  test('Crawler bekommt OG-Meta-Tags fuer einen Tracking-Link', async ({
    page,
    request,
  }) => {
    // 1) Link erstellen.
    await loginAsDevUser(page);
    await page.goto('/');
    await page.getByLabel(/Original-URL/i).fill('example.com');
    await page.getByRole('button', { name: 'Erzeugen' }).click();
    const trackingCode = page.locator('code', { hasText: /\/t\// }).first();
    await expect(trackingCode).toBeVisible({ timeout: 15_000 });

    // 2) Tracking-URL aus dem DOM lesen.
    const trackingHref = await trackingCode.textContent();
    expect(trackingHref).toBeTruthy();
    const path = new URL(trackingHref!).pathname;

    // 3) Mit Crawler-UA holen, OG-Tags pruefen.
    const res = await request.get(path, {
      headers: { 'user-agent': 'WhatsApp/2.23 (compatible OG-Crawler)' },
    });
    expect(res.ok()).toBe(true);
    const html = await res.text();
    expect(html).toContain('og:url');
    expect(html).toContain('og:type');
  });
});
