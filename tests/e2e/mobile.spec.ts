/**
 * E2E-Mobile-Smoke (Backlog Feature J).
 *
 * Prueft, dass die Item-Toolbar auf einem schmalen Mobile-Viewport
 * (iPhone SE, 375 x 667) nicht aus der Card bricht und die
 * Action-Buttons trotz Icon-Only-Darstellung bedienbar bleiben.
 *
 * Laeuft im chromium-Projekt; test.use() ueberschreibt nur
 * Viewport/UA/isMobile (Chromium unterstuetzt Mobile-Emulation).
 */
import { expect, test } from '@playwright/test';

// iPhone-SE-Viewport explizit emuliert (kein devices[]-Spread, weil das
// defaultBrowser: 'webkit' mitzieht — wir laufen aber im chromium-
// Projekt. isMobile/hasTouch sind Chromium-Features → passt).
test.use({
  viewport: { width: 375, height: 667 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

async function loginAsDevUser(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page
    .getByRole('button', { name: /dev@listate\.local einloggen/i })
    .click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  });
}

// Bewusst lange URL ohne Original-Titel: der Dashboard-/Detail-Titel
// faellt dann auf diese unumbrechbare URL zurueck — genau der Fall,
// der vor Feature J horizontalen Scroll erzeugte.
const LONG_URL =
  'https://example.com/wirtschaft/verbraucher/eine-sehr-lange-url-die-truncaten-soll-1234567890';

async function createLink(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByLabel(/Original-URL/i).fill(LONG_URL);
  await page.getByRole('button', { name: 'Erzeugen' }).click();
  await expect(page.locator('code', { hasText: /\/t\// })).toBeVisible({
    timeout: 15_000,
  });
}

async function hasHorizontalOverflow(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  );
}

test.describe('Listate-Mobile (iPhone SE)', () => {
  test('Dashboard hat keinen horizontalen Scroll', async ({ page }) => {
    await loginAsDevUser(page);
    await createLink(page);
    await page.goto('/dashboard');
    await expect(
      page.getByRole('heading', { name: 'Dashboard' })
    ).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('Detail-Seite hat keinen horizontalen Scroll', async ({ page }) => {
    await loginAsDevUser(page);
    await createLink(page);
    await page.goto('/dashboard');
    await page.locator('a[href^="/links/"]').first().click();
    await page.waitForURL(/\/links\//);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });

  test('Action-Buttons im Item sind klickbar (Icon-Only)', async ({
    page,
  }) => {
    await loginAsDevUser(page);
    await createLink(page);
    await page.goto('/dashboard');
    const editBtn = page
      .getByRole('button', { name: /Link bearbeiten/i })
      .first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
