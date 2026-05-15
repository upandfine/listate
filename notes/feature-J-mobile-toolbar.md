# Feature J — Mobile-Check der Item-Toolbar

Ziel: Auf Mobile-Viewports brechen aktuell Buttons in den Item-
Toolbars visuell aus. Dieses Feature behebt das mit Layout-Fixes,
ohne die Desktop-Variante anzufassen.

## Problem im Detail

**User-Beobachtung (2026-05-15):** Auf engen Viewports (≤ 414 px)
sprengen die Action-Buttons die Card-Breite oder erzeugen
zerrissene Wrap-Pattern.

Konkret betroffen sind zwei Stellen:

### Stelle 1: Dashboard-Item, rechte Spalte (Aktionen)

[`app/dashboard/page.tsx`](app/dashboard/page.tsx) Z. ~467–528:

```tsx
{/* Klicks + Sparkline + 3 Action-Buttons */}
<div className="flex items-center justify-between gap-3 rounded-b-lg border-t ... sm:flex-col sm:justify-center sm:rounded-b-none sm:rounded-r-lg sm:border-l sm:border-t-0 ...">
  <Link href={`/links/${link.id}`}>
    {/* Klick-Counter, Sparkline */}
  </Link>
  <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
    <EditLinkButton ... />          {/* "Bearbeiten" */}
    <PreviewOverrideButton ... />   {/* "Vorschau" */}
    <ConfirmButton ... />           {/* "Löschen" */}
  </div>
</div>
```

Auf Mobile (`< sm`): horizontal nebeneinander, `justify-between`.
Counter+Sparkline LINKS, drei Buttons RECHTS. Bei langen Button-
Labels („Bearbeiten" + „Vorschau" + „Löschen") + Sparkline (80 px)
+ Counter wird's eng. Sparkline schrumpft nicht, Buttons können
in 2-Zeilen-Wrap rutschen oder die Card überlaufen.

### Stelle 2: Dashboard-Item, oben (Tracking-URL + 3 Share-Buttons)

[`app/dashboard/page.tsx`](app/dashboard/page.tsx) Z. ~390–403:

```tsx
<div className="flex items-center gap-2">
  <a className="min-w-0 flex-1 truncate ..."> {trackingUrl} </a>
  <CopyButton />   {/* "Kopieren" */}
  <ShareButton />  {/* "Teilen" */}
  <QrButton />     {/* "QR" */}
</div>
```

Tracking-URL truncated korrekt, aber drei Button-Labels +
Padding können auf 320-px-Viewports immer noch zu eng werden.

### Stelle 3: Detail-Seite, Tracking-URL-Toolbar

[`app/links/[id]/page.tsx`](app/links/[id]/page.tsx) Z. 128–151:

```tsx
<div className="mt-2 flex flex-wrap items-center gap-2">
  <code className="min-w-0 flex-1 truncate rounded bg-neutral-100 px-3 py-2 text-sm">
    {trackingUrl}
  </code>
  <CopyButton />
  <ShareButton />
  <QrButton />
  <PreviewOverrideButton ... />
</div>
```

Vier Buttons + `<code>`. `flex-wrap` greift, also bricht es, statt
zu überlaufen — aber das Layout wird unschön.

## Lösungs-Optionen (Empfehlung markiert)

### Option A: Stacking + Icon-Only auf Mobile (empfohlen)

Auf `< sm`: Counter+Sparkline-Block UND Action-Buttons übereinander
stapeln. Button-Labels via `sr-only` auf Mobile verstecken, nur
das Icon zeigen. Ab `sm:` wieder mit Label.

**Pro:** Konsistent zum bestehenden Aria-Label-Pattern (Buttons haben
schon `aria-label`). Minimal-invasiv: drei `<Button>`-Komponenten
müssen ihre Label-Spans mit `hidden sm:inline` versehen. Sparkline
kann auf Mobile via `hidden sm:flex` weggelassen werden.

**Contra:** User muss die Icons kennen — Stift/Bild/Mülltonne sind
aber sehr etabliert.

### Option B: Drei-Punkte-Overflow-Menü

Auf Mobile: ein einziges `<button>` mit drei Punkten öffnet ein
Dropdown mit „Bearbeiten / Vorschau / Löschen". Ab `sm:` direkt
sichtbar.

**Pro:** Maximale Sauberkeit, kein UI-Druck mehr.

**Contra:** Neue Komponente (`<OverflowMenu>`) + Dropdown-Logik
(Click-outside, ESC-handling, Focus-Trap). Tendiert dazu „versteckt"
zu wirken — User entdeckt die Aktionen schlechter.

### Option C: Toolbar in eigene Reihe pro Mobile

Statt `justify-between` mit Counter links und Buttons rechts:
auf Mobile als zwei Reihen — Counter-Block oben, Buttons unten,
beide volle Breite. Ab `sm:` wie heute.

**Pro:** Einfachster Fix, keine Icon-Änderung nötig.

**Contra:** Item wird auf Mobile höher. Bei 25 Items pro Page könnte
die Liste sehr lang werden.

**→ Empfehlung: Option A.** Icon-Only auf Mobile ist Standard-Mobile-
UX, minimal-invasiv, keine neue Komponente nötig, und passt zum
existierenden aria-label-Setup.

## Konkrete Aufgaben-Reihenfolge

### Etappe 1: Button-Komponenten Icon-Only-Fähigkeit (~25 min)

In den vier betroffenen Button-Komponenten das Text-Label in einen
`<span className="hidden sm:inline">…</span>`-Wrapper packen:

- [`app/components/EditLinkButton.tsx`](app/components/EditLinkButton.tsx) Z. 61–64
- [`app/components/PreviewOverrideButton.tsx`](app/components/PreviewOverrideButton.tsx) Z. 213–216
- [`app/components/CopyButton.tsx`](app/components/CopyButton.tsx)
- [`app/components/ShareButton.tsx`](app/components/ShareButton.tsx)
- [`app/components/QrButton.tsx`](app/components/QrButton.tsx)

Für `ConfirmButton` (Löschen): der `buttonLabel`-Prop bekommt das
gleiche Pattern in den Aufrufer-Stellen (Dashboard + Detail).

Plus: aria-label überprüfen, dass es ohne Text-Label aussagekräftig
bleibt (ist es).

### Etappe 2: Dashboard-Item Layout (~20 min)

[`app/dashboard/page.tsx`](app/dashboard/page.tsx) Z. ~467:

- Sparkline auf Mobile verstecken: `hidden sm:flex` an
  `<Sparkline>`-Wrapper.
- Toolbar-Block: ggf. `gap-1` statt `gap-1.5` auf Mobile für mehr
  Platz.

Z. ~390–403 (Copy/Share/QR neben Tracking-URL): aktuell schon mit
`flex-wrap`, sollte mit Icon-Only Etappe 1 reichen.

### Etappe 3: Detail-Seite Layout (~15 min)

[`app/links/[id]/page.tsx`](app/links/[id]/page.tsx) Z. 128–151:

- Tracking-URL+`<code>` als eigene Reihe auf Mobile, Buttons als
  zweite Reihe: aktuell `flex flex-wrap items-center gap-2`. Lässt
  sich umstellen auf
  ```tsx
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
    <code className="...">{trackingUrl}</code>
    <div className="flex flex-wrap items-center gap-2">
      <CopyButton /><ShareButton /><QrButton /><PreviewOverrideButton />
    </div>
  </div>
  ```

### Etappe 4: E2E-Smoke auf Mobile-Viewport (~30 min)

Neue Datei [`tests/e2e/mobile.spec.ts`](tests/e2e/mobile.spec.ts):

```ts
import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['iPhone SE'] }); // 375 × 667

test('Dashboard hat keinen horizontalen Scroll auf iPhone SE', async ({ page }) => {
  // Login + Link erstellen wie in smoke.spec.ts
  // ...
  await page.goto('/dashboard');
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
});

test('Action-Buttons im Item sind klickbar auf iPhone SE', async ({ page }) => {
  // ...
  const editBtn = page.getByRole('button', { name: /Link bearbeiten/i });
  await expect(editBtn).toBeVisible();
  await editBtn.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
```

Plus: ggf. iPhone-12 (390 px) und Pixel-5 (393 px) als zusätzliche
projects in [`playwright.config.ts`](playwright.config.ts).

### Etappe 5: Manueller Cross-Browser-Check (~10 min)

Lokal mit Browser-DevTools-Mobile-Emulation durchklicken:

- iPhone SE (375 × 667)
- iPhone 12/13 (390 × 844)
- Pixel 5 (393 × 851)
- Galaxy Fold (280 × 653 — extrem schmal)

Stellen prüfen:
1. Dashboard mit ≥ 3 Items
2. Detail-Seite eines Links
3. Header (Hamburger-Menü)
4. Create-Form
5. Edit-Modal offen
6. Vorschau-Modal offen

### Etappe 6: BACKLOG-Update + Commit + Push (~5 min)

J als umgesetzt markieren mit Verweis auf Etappe-1/2/3-Commits.
Push auf main, CI grün abwarten (E2E-Job laeuft jetzt mit
iPhone-SE-Project mit).

## Edge-Cases

- **Buttons mit Modal:** `EditLinkButton`, `PreviewOverrideButton`,
  `ConfirmButton`, `QrButton` öffnen alle ein `<dialog>`-Modal. Modals
  selbst sind in Etappe H schon a11y-fit und nutzen `max-w-md` /
  `max-w-lg` / `max-w-2xl` — diese Größen auf Mobile prüfen, ob sie
  noch passen oder ob ein `max-w-[calc(100vw-2rem)]` mit dazu muss.
- **`ShareButton` Dropdown:** das WhatsApp/Telegram/etc.-Menü
  öffnet rechtsbündig. Auf Mobile-Rand könnte es überlaufen — schon
  jetzt prüfen.
- **Tracking-URL truncate:** in der Dashboard-Card ist das `<a>`
  truncated, gut. In der Detail-Seite das `<code>` truncated nicht
  → erweitert auf eigene Reihe (Etappe 3 löst das).

## Was zu vermeiden ist

- **Keine fundamentale Layout-Änderung des Desktop-Pfads.** Nur
  Mobile-spezifische Tweaks via `< sm:`-Prefix.
- **Keine Komplett-Neuschreibung der Toolbar-Komponenten.** Wenn
  Komponenten-DRY (Backlog D5) später kommt, wird die Toolbar
  ohnehin in eine `<ItemToolbar>`-Komponente extrahiert — Mobile-
  Fixes sind dann Teil davon. Aktuell: minimal-invasiv halten.

## Wenn du loslegst

1. Lies zuerst `CLAUDE.md` für die allgemeinen Konventionen.
2. Folge der Etappen-Reihenfolge. Etappe 1+2+3 zusammen in einem
   Commit machen (es ist ein zusammenhängendes Mobile-Layout-Fix).
3. Etappe 4 (E2E-Test) in eigenem Commit — falls der CI-Job zickt,
   ist es leicht zu reverten.
4. Frag mich vor dem Cross-Browser-Check (Etappe 5), falls du keinen
   Mobile-Browser zur Hand hast — ich kann das via DevTools-
   Emulation prüfen und dir Screenshots schicken.
