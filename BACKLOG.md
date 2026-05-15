# Backlog

Geplante Features. Konzeptphase – Details werden vor Implementierung
jeweils nochmal abgestimmt.

---

## Vorgemerkt für später

### A. Webhook bei jedem Klick ✅ umgesetzt

**Stand:** Pro User kann in den Settings ein HTTPS-Webhook hinterlegt
werden. `/t/[id]` POSTet bei jedem **Non-Crawler-Klick** asynchron
(fire-and-forget) einen JSON-Payload an die URL — der Redirect wird
nie blockiert. Signatur per HMAC-SHA256 im Header
`X-Listate-Signature: sha256=<HEX>`. Secret wird beim ersten Speichern
automatisch generiert und kann ueber „Secret neu erzeugen" rotiert
werden.

**Payload:**
```json
{
  "linkId": "abc123",
  "slug": "mein-slug",
  "originalUrl": "https://example.com/page",
  "clickedAt": "2026-05-13T12:00:00.000Z",
  "country": "DE",
  "userAgent": "Mozilla/5.0 ..."
}
```

**Implementierung:**
- Schema: `user.webhook_url`, `user.webhook_secret` (idempotenter
  Bootstrap via `ensureColumn`, synchron in `db/schema.ts`,
  `db/index.ts::bootstrap()`, `tests/utils/db.ts`).
- [`lib/webhook.ts`](lib/webhook.ts): `dispatchClickWebhook` mit
  injizierbarem `HttpClient` und `sleep`. Timeout 5 s pro Versuch
  (`AbortSignal.timeout`), 1× Retry nach 2 s bei 5xx/Netz/Timeout, kein
  Retry bei 4xx (Configuration-Error → User soll's fixen, nicht hammern).
- [`app/t/[id]/route.ts`](app/t/%5Bid%5D/route.ts): `void dispatch...catch()`
  parallel zu Klick-Counter + Geo-Lookup, NICHT awaited.
- Server-Actions in [`app/actions/webhook.ts`](app/actions/webhook.ts):
  `updateWebhook`, `regenerateWebhookSecret`, `clearWebhook`, `testWebhook`
  (Letzteres sendet einen Sample-Payload und liefert HTTP-Status +
  Latenz zurueck, damit der User sieht, dass der Empfaenger antwortet).
- UI: [`app/components/WebhookSettings.tsx`](app/components/WebhookSettings.tsx)
  als Client-Component im Settings-Bereich. Secret wird verschleiert
  (•••• + letzte 4 Zeichen) und nur per „Anzeigen"-Klick offengelegt.
- Audit-Log: `webhook.configured`, `webhook.cleared`,
  `webhook.secret_rotated` (URL wird **nicht** ins Audit-Log
  geschrieben — Empfaenger-URL kann Token-Auth tragen).

**Tests:**
- 13 Integration-Tests in [`tests/integration/webhook.test.ts`](tests/integration/webhook.test.ts)
  (no-op-Pfade, Payload-Form, HMAC-Signatur reproduzierbar, Retry-
  Verhalten 5xx/4xx/Netz/Timeout, Sleep-Aufruf).
- 18 Integration-Tests in [`tests/integration/webhook-actions.test.ts`](tests/integration/webhook-actions.test.ts)
  (Auth, Validation, DB-Updates, Audit-Log-Inhalt prueft KEINE URL-
  Leakage).
- 3 neue Tests in [`tests/integration/t-route.test.ts`](tests/integration/t-route.test.ts):
  Non-Crawler triggert Dispatch, Crawler nicht, Dispatch-Fehler
  blockiert HTTP 200 Redirect-Response nicht.

**DSGVO/Privacy:**
- IP geht NICHT raus (wir haben sie sowieso nicht gespeichert).
- userAgent geht raw mit — der Empfaenger ist der User selbst.
- URL des Empfaengers wird im Audit-Log nicht persistiert (koennte
  Token enthalten).

**Single-Instance-Schwachstelle:** Kein Retry-Queue, kein Buffering. Bei
Sliplane-Restart geht ein laufender fire-and-forget-Call verloren. Bei
erwartetem Klick-Volumen akzeptabel; bei Multi-Instance-Deploy
muesste eine Redis-Queue dazu.

### B. Geo-Tracking (datenschutzfreundlich) ✅ umgesetzt

**Stand:** Pro Klick wird der ISO-2-Letter-Country-Code (z. B. `DE`,
`CH`) in `clicks.country_code` abgelegt. Die IP wird ausschliesslich
im Request-Scope an `lookupCountry` weitergegeben und danach verworfen
— sie wird nirgends persistiert oder geloggt.

**Implementierung:**
- `lib/geo.ts`: `extractClientIp` (x-forwarded-for → x-real-ip,
  Loopback → null) + `lookupCountry` (geoip-lite, IPv6-mapped → IPv4,
  alle Fehler → null).
- Datenquelle: `geoip-lite` (~6 MB lokale GeoLite2-Snapshot-Daten,
  MIT-lizenziert). Update via `npm install geoip-lite` neu.
  Country-Granularitaet ist hinreichend stabil.
- Schema: `clicks.country_code TEXT NULL` + Index
  `idx_clicks_country_code`. Synchron in `db/schema.ts`,
  `db/index.ts::bootstrap()` (mit `ensureColumn` fuer Bestands-DBs)
  und `tests/utils/db.ts`.
- Aggregations-Helper: `getCountryBreakdown(db, linkId, days)` in
  `lib/clickStats.ts`, sortiert nach count desc, `null`-Klicks als
  eigene Gruppe.
- UI:
  - Link-Detail-Seite (`/links/[id]`) hat eine „Herkunft"-Sektion
    mit Top-10-Bargraph (deutsche Laender-Namen via `Intl.DisplayNames`).
  - Admin-Stats (`/admin/stats`) hat ein „Top-Laender"-Widget mit
    Tabelle (90 Tage, alle User).
- `/api/export` (DSGVO Art. 20) liefert pro Klick nun
  `{ clickedAt, country }` statt nur des Timestamps.
- `next.config.mjs`: `geoip-lite` in `serverExternalPackages`
  (geoip-lite laedt seine `.dat`-Dateien per `fs.readFileSync` auf
  Module-Init, was Bundling bricht) plus
  `outputFileTracingIncludes` fuer das standalone-Build.
- Datenschutz-Seite (`/datenschutz`, Abschnitt 5.2) explizit
  aktualisiert: Country-Code aus IP, IP wird nicht gespeichert,
  keine Stadt/PLZ.

**Tests:** 15 Unit-Tests in `tests/unit/geo.test.ts`,
4 neue Integration-Tests in `tests/integration/t-route.test.ts`,
5 in `tests/integration/clickStats.test.ts` (`getCountryBreakdown`),
plus erweiterter `api-export`-Test fuer das `country`-Feld.

### E. Testing-Strategie + Gherkin-Automatisierung

**Ziel:** Die in `/features/*.feature` festgehaltenen Verhaltensspezifikationen
in ausführbare Tests übersetzen — und mittelfristig zur Regressionsbasis
für jeden weiteren Pull-Request machen.

#### Ist-Zustand
- [features/](features) enthält Gherkin-Specs in deutscher Sprache für
  alle Hauptfunktionen (Auth, Create, Edit, Tracking, Dashboard,
  Stats, Templates, Admin, Account, Security).
- Die Specs sind nicht automatisiert — bisher reine Doku/Manuelle QA-Vorlage.

#### Soll-Architektur (Test-Pyramide)

```
        ┌────────────┐
        │  E2E (5%)  │  Playwright + Cucumber (BDD), 1× pro Hauptpfad
        ├────────────┤
        │  Int (25%) │  Vitest gegen In-Memory-SQLite, Server-Actions
        ├────────────┤
        │ Unit (70%) │  Vitest auf reine Helper (lib/*)
        └────────────┘
```

**Unit (Vitest, schnell, viele):**
- `lib/slug.ts`, `lib/tags.ts`, `lib/host.ts`, `lib/ttl.ts`, `lib/safeRedirect.ts`
- `lib/sparkline.ts`, `lib/clickStats.ts` (mit In-Memory-DB)
- `lib/resolveTemplateUrl.ts` (mit gemocktem fetch)
- `lib/safeBrowsing.ts` (mit gemocktem fetch)
- `lib/createTrackingLink.ts` (mit In-Memory-DB + gemocktem ogs)
- Ziel: ≥ 80 % Branch-Coverage auf `lib/`.

**Integration (Vitest, mittel):**
- Server-Actions: `createTemplate`, `useTemplate`, `updateLink`,
  `deleteLink`, `blockHost`, `deleteAccount` — jeweils mit
  In-Memory-SQLite und gemocktem `auth()`.
- API-Routes: `/api/create`, `/api/links`, `/api/export`, `/api/health`.
- DB-Migrationen: Bootstrap auf legacy-Schema → erwartete Spalten.

**End-to-End (Playwright + @cucumber/cucumber, langsam, gezielt):**
- Übersetzt jeden `.feature`-Datei in einen Test-Lauf gegen einen
  echten Dev-Server (Port 3041) mit eigenem `data/test.db`.
- Step-Definitions in `tests/e2e/steps/*.ts`, die mit dem Dev-Bypass
  einloggen und über die UI klicken (Playwright-Page-Object).
- Mindestens für jedes der 10 `.feature`-Files ein Smoke-Test über
  den Happy-Path.
- CI: GitHub Actions matrix (Chromium, optional Firefox).

#### Konkrete Bausteine (Reihenfolge)

1. ~~**Setup (1 h)**~~ — **umgesetzt**
   - `vitest` + `@vitest/coverage-v8` installiert (Vitest 4 nutzt nativ
     `resolve.tsconfigPaths: true`, daher kein separates Plugin).
   - [`vitest.config.ts`](vitest.config.ts) mit `tests/unit/**/*.test.ts`
     und `tests/integration/**/*.test.ts` im Include-Pfad.
   - Scripts `test`, `test:watch`, `test:cov`, `typecheck` in `package.json`.

2. ~~**Unit-Tests Helper (3 h)**~~ — **umgesetzt**
   - 105 Unit-Tests in `tests/unit/` für `slug`, `tags`, `ttl`, `host`,
     `safeRedirect`, `safeBrowsing` (fetch-Mock), `resolveTemplateUrl`
     (fetch-Mock), `adultFilter` (fs-Mock + Modul-Reset).
   - 19 Integration-Tests in `tests/integration/` für `sparkline` und
     `clickStats` (gegen In-Memory-SQLite).
   - Coverage auf den 10 getesteten Helpern: **97.8 % Statements,
     100 % Functions, 98.9 % Lines, 92.2 % Branches** (Restbranches
     sind defensive Guards für malformed Input).
   - Threshold in [`vitest.config.ts`](vitest.config.ts) auf 90 % gesetzt.
   - **Offen:** `createTrackingLink` (orchestriert die obigen Filter +
     OG-Scraper, gehört in Integration-Tests gegen In-Memory-DB),
     `generateId` (braucht DB-Setup mit echtem `getDb()`). Kommt in
     Schritt 4.

3. ~~**In-Memory-DB-Helper (1 h)**~~ — **umgesetzt**
   - [`tests/utils/db.ts`](tests/utils/db.ts): `createTestDb()` liefert
     eine frische SQLite-Instanz im RAM (`:memory:`) mit dem produktiven
     Schema (links, clicks, user, templates, blocked_hosts) plus
     Indexen.
   - Seed-Helper `seedUser`, `seedLink`, `seedClicks` mit
     produktions-getreuen Timestamp-Formaten (`'YYYY-MM-DD HH:MM:SS'`).
   - **Bewusst nicht** über `getDb()` aus `db/index.ts`, weil die
     Filesystem-DB anlegt und zwischen Tests persistiert. Schema-Drift
     gegenüber Produktion wird in Schritt 4 (Migration-Test)
     abgesichert.

4. ~~**Integration-Tests (3 h)**~~ — **umgesetzt**
   - **`lib/createTrackingLink.ts`** (27 Tests): validate (HTTPS,
     Block-Liste, Adult-Filter, Safe Browsing), Rate-Limit, fetchOg
     (OG/Twitter-Fallback, alle Image-Varianten), Slug-Check
     (Konflikt, Edit-Exclude), End-to-End-Pfad inkl. FK-Violation-
     Wrapper.
   - **API-Routes** (38 Tests in 4 Files):
     - `/api/create` (12): Auth, Body-Validation, Happy Path mit
       Slug/TTL/Tags, TrackingLinkError-Statuses 400/403/500 werden
       als JSON durchgereicht, Generic-500-Fallback.
     - `/api/links` (8): Owner-Filter, expired-Toggle, Admin sieht
       alle Links bzw. mit `?user=` gefiltert, tracking_url-Anhang.
     - `/api/export` (4): JSON-Download-Header, Filename-Format,
       eigene Links + Klicks vs. fremde.
     - `/api/health` (3): 200-OK mit Latenz, 503 bei DB-Ping-Fehler.
   - **Server-Actions in app/actions.ts** (42 Tests):
     - `updateLink`: Auth, Berechtigung, Schema-Ergaenzung, TTL-Clear,
       Slug-Konflikt vs. Edit-Exclude.
     - `deleteLink`: Owner-only, Admin-Override.
     - `blockHost`/`unblockHost`: Admin-Pflicht, Host-Normalisierung,
       Upsert, `alsoDelete`-Pfad mit Bulk-Delete.
     - `deleteAccount`: Cascade-Delete + signOut-Aufruf.
     - `createTemplate`/`deleteTemplate`/`testTemplatePattern`:
       Admin-Pflicht, Validierung von URL/Regex/Pattern.
     - `useTemplate`: Mit/ohne Pattern, Resolver-Fehler,
       redirect-Verhalten (`NEXT_REDIRECT`-Error wird im Test
       gefangen).
   - Mock-Stack je Test-Datei: `@/db`, `@/auth`, `next/cache`,
     `next/navigation` (redirect imitiert `NEXT_REDIRECT`),
     `open-graph-scraper`, `@/lib/adultFilter`, `@/lib/resolveTemplateUrl`.
   - Coverage ueber jetzt 16 Files (10 lib + actions.ts + 4 API-Routes):
     **96.94 % Statements, 100 % Functions, 98.07 % Lines, 90.25 %
     Branches**. Threshold global 90 (Branches 88, weil viele
     defensive Catch-Fallbacks).
   - **Bekannte Schwachstelle entdeckt:** `updateLink` wrappt JEDEN
     Error im Generic-Catch, auch „Nicht angemeldet" — Aufrufer kann
     401-Fall nicht unterscheiden. Test bildet das Ist-Verhalten ab;
     saubere Trennung steht in Feature D Punkt 4.

5. ~~**E2E-Setup (3 h)**~~ — **umgesetzt**
   - [`playwright.config.ts`](playwright.config.ts) mit Dev-Server-
     Auto-Start auf Port 3041 (eigener Port, kein Konflikt mit Port
     3000). Eigene Test-DB `data/e2e-test.db`, `DEV_AUTH_BYPASS=true`.
   - `globalSetup` raeumt Tabellen-Inhalte via SQL DELETE auf (NICHT
     File-Loeschung, weil Dev-Server beim Health-Check vor dem Setup
     schon eine Connection geoeffnet hat → File-Delete wuerde Phantom-
     Handle erzeugen, der zu FOREIGN KEY-Violations fuehrt). og-images-
     Verzeichnis bleibt File-System-basiert.
   - **Bewusst KEIN playwright-bdd / Cucumber:** Letzte playwright-bdd-
     Version (8.5.0) inkompatibel mit Playwright 1.60. Pure
     Playwright-Tests in TypeScript, Gherkin-Specs unter `features/`
     bleiben als Behavior-Doku.

6. **Step-Definitions schreiben** — teilweise umgesetzt
   - [`tests/e2e/smoke.spec.ts`](tests/e2e/smoke.spec.ts): 6 Smoke-
     Tests fuer die Hauptpfade (Health, Landing, Login + Dashboard,
     Tracking-Link-Erstellung, Settings/Datenexport, Crawler-Vorschau
     mit OG-Meta-Tags). Laeuft in 7s lokal.
   - **Offen:** Tests fuer Edit-Link, Tags-Filter, Pagination, Vorschau-
     Override, Template-Erzeugung, Admin-Blockliste, Account-Loeschung
     — 1:1 zu den anderen Gherkin-Features. Aufwand: 2–3 h pro
     Feature-Block.

7. ~~**CI-Workflow (1 h)**~~ — **umgesetzt + E2E-Job**
   - [`.github/workflows/ci.yml`](.github/workflows/ci.yml): bei jedem
     Push/PR auf `main` → quality-Job (lint, typecheck, test:cov, build)
     + e2e-Job (Playwright-Chromium, abhaengig von quality).
   - Coverage-Report + Playwright-HTML-Report als Artifacts mit 14 Tagen
     Retention.
   - `concurrency`-Gruppe bricht ältere Runs auf demselben Branch ab.

**Realistischer Restaufwand: ~10–12 h**, verteilt auf 2–3 weitere Sessions.

#### Quality-Gates nach Vollausbau
- Jeder PR: Unit + Integration grün, Coverage-Threshold gehalten.
- Nightly: E2E grün auf Chromium.
- BACKLOG-Features dürfen erst gemerged werden, wenn das jeweilige
  Gherkin-Feature im `features/`-Ordner liegt **und** mindestens ein
  Step-Definition-Stub existiert.

---

### ~~Z. Next.js Major-Update auf 16.x~~ (umgesetzt)

Migration von Next 14.2.35 → 16.2.6 erfolgreich durchgeführt.

**Konkret angepasst:**
- `experimental.serverComponentsExternalPackages` → top-level
  `serverExternalPackages`
- `experimental.outputFileTracingIncludes` → top-level
  `outputFileTracingIncludes`
- `headers()` aus `next/headers` ist async geworden →
  `lib/baseUrl.ts` zu `async function getBaseUrl(): Promise<string>`,
  alle 5 Aufrufer (`dashboard`, `links/[id]`, `templates`,
  `api/links`, `api/create`) auf `await` umgestellt
- Route-Handler-`params` ist jetzt Promise → `app/t/[id]/route.ts`
  destrukturiert mit `const { id } = await params`
- `middleware.ts` → `proxy.ts` (Next 16 File-Convention)

**Verifiziert:**
- Build sauber durch (23 Routen)
- Dev-Server smoke-getestet: `/`, `/login`, `/api/health`,
  `/datenschutz`, `/icon.svg`, `/robots.txt` antworten 200
- Alle 6 Security-Header weiterhin auf jeder Antwort gesetzt
- `npm audit`: High-Severity weg, nur noch moderate (transitive
  Dev-Deps, akzeptabel)

**Bekannte Restwarnung:** „Next.js inferred your workspace root" –
weil das übergeordnete Verzeichnis `dev/evangelisation/` eine
`package-lock.json` hat. Behebung via `turbopack.root` in
`next.config.mjs` ist möglich, aber low-prio.

---

### D. Refactoring + Hardening (technische Schulden)

**Ziel:** Die App ist organisch gewachsen. Bevor neue Features hinzukommen,
einmal SOLID/Clean-Code-Audit + Quality-Gates installieren, damit die
Wartbarkeit langfristig sauber bleibt.

#### Konkrete Bausteine

**1. Tests**
- **Vitest** für Unit-Tests aufsetzen.
- Mindest-Coverage 60 % auf `lib/` (Helper sind die kritischste Schicht):
  - `lib/slug.ts`, `lib/tags.ts`, `lib/ttl.ts`, `lib/host.ts`
  - `lib/createTrackingLink.ts` (Validation + Rate-Limit + OG-Mocks)
  - `lib/resolveTemplateUrl.ts`, `lib/adultFilter.ts`, `lib/safeBrowsing.ts`
- **Playwright** für End-to-End:
  - Login (Dev-Bypass)
  - Link erstellen → Dashboard zeigt ihn
  - Link bearbeiten → URL-Wechsel zieht neues OG
  - Vorlage anlegen + nutzen
  - Account löschen
- CI-Hook (GitHub Actions) der Tests bei jedem Push laufen lässt.

**~~2. Strukturiertes Logging~~** — umgesetzt
- ~~`pino` statt `console.error`~~: [`lib/logger.ts`](lib/logger.ts) exportiert
  eine pino-Instanz (JSON-Output in Prod/Dev, `enabled: false` in
  NODE_ENV=test damit Vitest stumm bleibt). `redact` zensiert
  `password|token|authorization|cookie` defensiv.
- ~~Server-Action-Errors strukturiert~~: `toActionFail` und
  `executeOrRedirect` in [`lib/actionResult.ts`](lib/actionResult.ts) loggen
  jetzt `{ action, err: { name, message, stack } }` statt frei-formatiertem
  `console.error`. Selbiges in [`lib/auditLog.ts`](lib/auditLog.ts) und
  [`lib/adultFilter.ts`](lib/adultFilter.ts).
- ~~Trace-ID je Request~~: `newTraceId()` erzeugt eine 8-Zeichen-Korrelations-ID;
  [`app/api/create/route.ts`](app/api/create/route.ts) reicht sie im Error-Log
  durch (`{ route, traceId, userId, err }`). Bei kuenftigen Route-Handlern
  als Pattern uebernehmen.
- ~~JSON-Logs fuer Sliplane~~: pino schreibt ohne pino-pretty, also
  zeilenweise JSON auf stdout — direkt von Sliplane/Caddy parsbar.
- **Bewusst nicht ersetzt:** `app/error.tsx` (Client-Component, dort gehoert
  Browser-`console.error` hin — pino waere Bundle-Bloat ohne Mehrwert).

**3. TypeScript-Hygiene** — teilweise umgesetzt
- ~~`tsconfig.json` um `noUnusedLocals`, `noUnusedParameters`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch` erweitern.~~
  **Erledigt:** Alle vier Flags aktiv, keine neuen Errors aufgetreten —
  ESLint (`@typescript-eslint/no-unused-vars` mit `^_`-Pattern) und
  saubere Codebase machen die Erweiterung schmerzfrei.
- ~~`any`/`unknown`-Casts auditieren~~: systematisch durchgegangen.
  **Production-Code hat NULL `any`-Casts.** `unknown`-Vorkommen alle
  legitim (Drizzle-Generic-Parameter, catch-Clause-Standard,
  JSON-Body-Validation-Eingang vor Zod, `pickImage`-defensive für
  variable OG-Library-Shapes). Keine Aktionen erforderlich.
- ~~Drizzle-Query-Returns in Domain-Types extrahieren (`db/types.ts`)~~:
  umgesetzt. [`db/types.ts`](db/types.ts) exportiert `linkListProjection`
  (Drizzle-Select-Objekt fuer Link-Detail- und Dashboard-Spalten plus
  `ownerEmail`-Join) sowie die abgeleiteten Typen `LinkListRow` /
  `LinkListRowWithOwnerName`. [`app/dashboard/page.tsx`](app/dashboard/page.tsx)
  und [`app/links/[id]/page.tsx`](app/links/[id]/page.tsx) referenzieren
  jetzt die zentrale Projektion statt 17 Felder zweimal inline zu listen.

**~~4. Server-Actions vereinheitlichen~~** — umgesetzt
- ~~Einheitliches ActionResult-Pattern~~:
  [`lib/actionResult.ts`](lib/actionResult.ts) definiert
  `ActionResult<T> = {ok:true} | {ok:true, data} | {ok:true, redirect} | {ok:false, error}`.
  Konstruktoren `actionOk`, `actionOkData`, `actionRedirect`, `actionFail`.
- ~~Zod-Schemas~~ in [`lib/actionSchemas.ts`](lib/actionSchemas.ts) für alle
  FormData-Inputs (updateLink, deleteLink, blockHost, unblockHost,
  createTemplate, deleteTemplate, useTemplate, updateLinkOverrides,
  clearLinkImageOverride, testTemplatePattern). `parseFormData(fd, schema)`
  als Single-Entry-Point.
- ~~Typisierte Fehler-Klassen~~ `AuthError`, `PermissionError`,
  `ValidationError` mit `toActionFail()`-Mapper, der `TrackingLinkError`
  und die drei eigenen Klassen 1:1 als User-Message durchreicht.
  „Nicht angemeldet."-Fall ist jetzt UNTERSCHEIDBAR vom Generic-500;
  damit ist die bekannte Schwachstelle aus dem OG-Override-Bau weg.
- Form-Action-Wrapper (deleteLinkFormAction, blockHostFormAction, …)
  fuer die Server-Component-Forms, die `Promise<void>` erwarten.
  Sie rufen die ActionResult-Action und fuehren bei redirect-Result
  `next/navigation.redirect()` aus.
- ~~`useTemplate` umbenennen in `applyTemplate`~~: umgesetzt mit D9.
- ~~Action-File splitten nach Domain~~: siehe Punkt 9 unten.

**5. Komponenten-Architektur**
- `CreateLinkForm` und `EditLinkButton` haben überlappende
  URL-/Slug-/Tags-Eingabe-Logik. Extrahieren in `LinkFormFields` (Shared
  Component) – DRY-Prinzip.
- Wiederverwendbare UI-Primitives (`<Button>`, `<Input>`, `<Modal>`,
  `<Badge>`) statt überall Tailwind-Klassen-Wiederholung.
- Shared Types nach `types/` (Link-Detail, ServerActionResult, …).

**6. Datenbank-Hygiene** — teilweise umgesetzt
- ~~Migrationen via `drizzle-kit generate` einrichten~~: erledigt.
  [`drizzle.config.ts`](drizzle.config.ts), [`drizzle/`](drizzle/)-Ordner
  mit README, `npm run db:generate` und `npm run db:check`.
  `migrate()`-Aufruf nach `bootstrap()` in [`db/index.ts`](db/index.ts);
  bei leerem Migrations-Ordner ist es ein no-op.
- **Offen**: Bestehendes Bootstrap (CREATE TABLE IF NOT EXISTS +
  ensureColumn) als „Initial-Seeder" beibehalten — drizzle-kit kommt
  ab Migration 0001. Wenn das initiale Schema einmal vollständig in
  Migrations gewandert ist (z. B. via synthetisches Catch-Up auf
  Live-DB), kann `bootstrap()` durch einen leeren Marker ersetzt werden.
- ~~`WAL`-Aktivierung + `busy_timeout`~~ bleiben im Bootstrap.

**7. Performance** — teilweise umgesetzt
- ~~Bundle-Analyse (`@next/bundle-analyzer`)~~: integriert in
  [`next.config.mjs`](next.config.mjs), `npm run analyze` erzeugt
  `.next/analyze/*.html`.
- ~~Schwere Client-Bundles lazy laden~~: `qrcode` (~75 KB) in
  [`QrButton.tsx`](app/components/QrButton.tsx) wird jetzt erst beim
  ersten Klick auf den QR-Button via `await import('qrcode')` geladen.
  Vorher war es im initialen Bundle jeder Seite mit `QrButton` (Dashboard,
  Create-Card, Detail-Seite). Heatmap + Sparkline sind Server-Components
  (SSR) → kein Client-Bundle-Impact, kein Lazy-Loading sinnvoll.
- **Offen:** OG-Bilder im Dashboard via `<Image>` mit Proxy-Loader
  (Privacy: Owner sieht fremde Hosts nicht direkt).

**8. Security-Härtung** — überwiegend umgesetzt
- ~~**CSP-Header**~~ aktiv in [`next.config.mjs`](next.config.mjs):
  default-src 'self', frame-ancestors 'none', base-uri 'self',
  object-src 'none'. `'unsafe-inline'` für Scripts/Styles ist
  pragmatisch nötig (Next.js-Bootstrap + /t/[id]-Redirect-Script);
  saubere Variante mit Nonce-Middleware steht im Refactor-Backlog.
- ~~**HSTS-Header**~~ aktiv: `max-age=63072000; includeSubDomains; preload`.
- ~~**X-Frame-Options: DENY**~~ aktiv.
- ~~**Referrer-Policy: strict-origin-when-cross-origin**~~ aktiv.
- ~~**X-Content-Type-Options: nosniff**~~ aktiv.
- ~~**Permissions-Policy**~~ deaktiviert camera/microphone/geolocation/
  payment/usb/magnetometer/gyroscope/accelerometer.
- ~~**Rate-Limit auch auf `/api/links` und `/api/export`**~~ umgesetzt:
  Generischer In-Memory-Sliding-Window-Counter in
  [`lib/rateLimit.ts`](lib/rateLimit.ts). `/api/links` 300/h pro User,
  `/api/export` 10/h pro User. Bei Trigger: HTTP 429 +
  `Retry-After`-Header. 9 Tests inkl. Sliding-Window-Edge-Cases.
  **Hinweis:** Counter ist pro Prozess (Single-Instance-Deploy ok auf
  Sliplane). Bei Multi-Instance müsste auf Redis umgestellt werden.

**9. Operationelles** — umgesetzt
- ~~`/api/health`-Endpoint~~ aktiv (200 OK + DB-Ping).
- ~~Backup-Skript fuer SQLite~~: [`scripts/backup-db.sh`](scripts/backup-db.sh)
  nutzt SQLite-Online-Backup-API + `integrity_check` + gzip + 14-Tage-
  Rotation. [`scripts/verify-backup.sh`](scripts/verify-backup.sh) als
  Restore-Smoke-Test (PRAGMA-Check + Quick-Counts). README mit
  Sliplane-Cron-Setup ([`scripts/README.md`](scripts/README.md)).
  `sqlite` + `bash` im Production-Container nachinstalliert.
- ~~`.well-known/security.txt`~~ in [`public/.well-known/security.txt`](public/.well-known/security.txt)
  (Expires 2027, mailto, Canonical, Policy).

**10. SOLID-Audit konkret**
- **S**ingle Responsibility: aktuell ist `createTrackingLink` schon
  gut zerlegt (validate / fetch / insert). ~~`actions.ts`-Datei
  (1 große File mit 8 Actions) splitten nach Domain~~ — umgesetzt
  mit D9: `app/actions/{links,og-overrides,templates,admin,account}.ts`,
  shared helpers in `lib/actionHelpers.ts` + `lib/actionResult.ts`.
- **O**pen/Closed: Resolver-Pipeline (Block-Liste → Adult → Safe Browsing)
  als Chain-of-Responsibility refaktorisieren. Neue Filter ohne
  Änderung am Aufrufer einhängbar.
  **Status:** offen, aber niedrige Prioritaet. Aktueller Code (50 Zeilen
  inline in `validateTrackingUrl`) ist gut lesbar; Chain-Refactor wuerde
  Boilerplate ohne aktuellen Vorteil hinzufuegen. Sinnvoll, sobald ein
  neuer Filter konkret ansteht (z. B. Phishing-Domain-Heuristik, neue
  Threat-Quelle).
- **L**iskov: keine offensichtlichen Verstöße.
- **I**nterface Segregation: `Database`-Pass-Through-Args reduzieren –
  Helper bekommen nur `db`, was sie brauchen, statt der ganzen Drizzle-
  Instanz. (Eher kosmetisch.)
- ~~**D**ependency Inversion~~: umgesetzt mit [`lib/http.ts`](lib/http.ts):
  `HttpClient = typeof fetch`-Type-Alias, `safeBrowsing` und
  `resolveTemplateUrl` akzeptieren optionalen `http`-Parameter
  (Default = global fetch). Tests koennen den Client direkt injizieren
  statt via `vi.stubGlobal`. Bestehende Tests weiter gruen (Default-
  Pfad nutzt global fetch).

#### Reihenfolge-Empfehlung

1. **Quick wins** (~2 h): tsconfig-Tightening, Health-Endpoint, CSP/HSTS-Header.
2. **Tests** (~4 h): Vitest + 6 Lib-Specs, ein Playwright-Smoke.
3. **Refactor** (~3 h): `actions.ts` splitten, `LinkFormFields`-Shared,
   Zod-Validation für 2-3 Hauptactions.
4. **Drizzle-Migrationen** (~1 h): `drizzle-kit generate` einführen,
   `ensureColumn` deprecaten.
5. **Logging** (~1 h): pino + Trace-IDs.

Realistischer Gesamtaufwand: **~10–12 h** verteilt auf mehrere Sessions.
Sollte gemacht werden, **bevor** Webhook/Geo/Multi-Domain dazukommen,
weil die sonst auf wackelige Architektur aufsetzen.

---

### C. Multi-Domain (eigene Tracking-Domain pro User)

**Ziel:** User können statt `listate.de/t/abc` einen Link unter ihrer
eigenen Domain anbieten, z. B. `links.upandfine.de/t/abc`. Sieht
vertrauenswürdiger aus, weil Empfänger die Marke kennen.

**Skizze:**
- Neue Tabelle `domains`: `id`, `user_id`, `host`, `verified_at`,
  `created_at`.
- User trägt in Settings einen Hostnamen ein (z. B.
  `links.upandfine.de`). Listate zeigt einen Verifizierungs-Token,
  den der User als TXT-Record in seiner DNS hinterlegt.
- Verifizierungs-Job: ruft `dns.resolveTxt(host)` auf, prüft Token.
- Ist der Host verifiziert, muss er noch CNAME auf `listate.de`
  setzen, damit HTTPS-Traffic ankommt.
- TLS: Sliplane oder vorgelagerter Proxy (Caddy) automatisches
  Let's Encrypt für die Custom-Domain. Sliplane unterstützt das
  — pro Domain manuelle Konfiguration nötig, ggf. API.
- `/t/[id]`-Endpoint erkennt anhand des `Host`-Headers, von welcher
  Domain die Anfrage kommt, und zeigt entsprechend (Funktion bleibt
  identisch, nur Branding könnte später unterschiedlich sein).
- Beim Erstellen eines Tracking-Links: Dropdown „auf welcher Domain
  veröffentlichen?" mit allen verifizierten User-Domains plus
  `listate.de` als Default.

**Hauptaufwand:** TLS-Provisioning per Sliplane-API + DNS-Verifizierung
+ Domain-bezogenes Routing. Realistisch ein voller Tag Arbeit, plus
laufender Support-Aufwand bei DNS-Problemen.

**Hinweis:** Erst lohnenswert, wenn 5+ Nutzer eigene Domains wollen.

---

### ~~F. OG-Scraper-User-Agent~~ — umgesetzt (Hybrid-Retry)

Implementiert in [`lib/createTrackingLink.ts`](lib/createTrackingLink.ts):
- Erster Versuch mit ehrlichem `ListateBot/1.0`-UA. Höflich, sites die
  Bots erlauben sehen wer wir sind.
- Bei verdächtiger Antwort (OG-Title matched `/browser ist veraltet|
  browser is out of date|update your browser|please upgrade your
  browser|unsupported browser/i`) automatisch Retry mit Chrome-UA.
- Wenn Browser-Retry NICHTS besseres liefert (auch verdächtig oder
  leer), bleibt die honest-Antwort — User kann via
  [`PreviewOverrideButton`](app/components/PreviewOverrideButton.tsx)
  manuell setzen.
- 9 Unit-Tests in
  [`tests/integration/createTrackingLink.test.ts`](tests/integration/createTrackingLink.test.ts)
  inkl. parametriertes Pattern-Set.

Manuelle Verifikation mit `https://upandfine.de` und `https://www.united-domains.de`
ausstehend — das wird sich beim nächsten Test-Link zeigen.

---

### ~~I. Audit-Log-Stream (ISO 25010 Security · Non-Repudiation)~~ — umgesetzt

Eigene `audit_log`-Tabelle ([`db/schema.ts`](db/schema.ts) +
idempotenter Bootstrap in [`db/index.ts`](db/index.ts), plus passende
Indexe `(user_id, created_at)` und `(action, created_at)`).
[`lib/auditLog.logAuditEvent`](lib/auditLog.ts) als defensiver
Writer (DB-Fehler crasht den Aufrufer nicht).

Erfasste Actions:
- `link.deleted` (mit originalUrl + owner in metadata)
- `link.bulk_deleted` (bei blockHost + alsoDelete)
- `host.blocked` / `host.unblocked`
- `template.created` / `template.deleted` / `template.applied`
- `account.deleted` (userId=null, weil User selbst weg; email in metadata)

11 Integration-Tests in [`tests/integration/auditLog.test.ts`](tests/integration/auditLog.test.ts):
direkter Writer + jede Action verifiziert das Log-Verhalten.

**Bewusst NICHT geloggt:** updateLink, updateLinkOverrides,
uploadLinkImage — zu hochfrequent, wuerde audit_log zumuellen ohne
Sicherheitsmehrwert.

**Offen:** Admin-UI zur Audit-Log-Ansicht (eigene Session).

---

### H. Accessibility (ISO 25010 Usability)

**~~H1. eslint-plugin-jsx-a11y hochfahren~~** — umgesetzt
In [`eslint.config.mjs`](eslint.config.mjs) 28 WCAG-AA-relevante Regeln
explizit auf `error`/`warn` gesetzt (alt-text, anchor-is-valid,
aria-* family, heading-has-content, html-has-lang, label-has-
associated-control, no-noninteractive-tabindex, role-has-required-
aria-props, scope, etc.). Plugin ist via eslint-config-next
registriert, wir verstaerken nur die Regeln (kein Plugin-Reimport,
sonst Config-Conflict).

**~~H2. Backdrop-Click-Modals: Disable mit Begruendung~~** — umgesetzt
8 Warnings in ConfirmButton/EditLinkButton/PreviewOverrideButton/
QrButton mit Disable-Kommentar entschaerft: `<dialog>` handelt ESC
nativ (via `onCancel`), Tastatur-Nutzer haben aequivalenten Pfad.

**~~H3. Skip-Link in app/layout.tsx~~** — umgesetzt
`sr-only`-Skip-Link springt direkt in den Hauptinhalt, sichtbar bei
Tab-Focus. `<main>` hat `id="main"` und `tabIndex={-1}` fuer den
programmatischen Focus-Target.

**Offen (eigene Session):**
- Vollstaendiger axe-core-Run als Playwright-Test (kommt mit E5/6)
- Manueller NVDA/VoiceOver-Check auf Hauptpfaden
- Color-Contrast-Audit (vermutlich okay durch Tailwind-Defaults, aber
  nicht systematisch geprueft)
- Focus-Trap-Test fuer alle Modals (Browser-Default ist da, aber
  ggf. nicht 100 % bei dynamischem Inhalt)

---

### J. Mobile-Check der Item-Toolbar

**Problem (User-Beobachtung, 2026-05-15):** Auf Mobile-Viewports
brechen die Buttons in der Dashboard-Item-Toolbar visuell aus —
„Bearbeiten" / „Vorschau" / „Löschen" landen nebeneinander mit
Copy / Share / QR plus dem Klick-Counter, und auf engen Screens
sprengt das die Card-Breite oder erzeugt zerrissene Wrap-Pattern.

**Vermutete Stellen:**
- [`app/dashboard/page.tsx`](app/dashboard/page.tsx) Z. ~500ff.
  (Item-Toolbar mit `flex flex-wrap items-center gap-1.5` rechts
  vom Sparkline-Block).
- [`app/links/[id]/page.tsx`](app/links/[id]/page.tsx) Z. 144
  (Tracking-Link-Header mit Copy/Share/QR/Vorschau-Buttons).

**Was zu tun ist:**
1. Mobile-Viewports systematisch durchklicken (320 px Min-Width,
   375 px iPhone-SE, 414 px iPhone-Pro). Welche Buttons brechen
   wirklich aus, welche wrap'en nur ungelenk?
2. Optionen:
   - Toolbar auf Mobile als zwei Reihen: `flex-col sm:flex-row`
     (Action-Buttons rechts oben, Copy/Share/QR in eigener Reihe).
   - Sekundär-Aktionen (Bearbeiten/Vorschau/Löschen) in ein
     Drei-Punkte-Menü auf Mobile, ausgefahren ab `sm:`.
   - Klick-Counter + Sparkline kompakter auf Mobile (z. B. nur
     Counter, Sparkline ab `sm:` sichtbar).
3. E2E-Test mit Playwright auf 375-px-Viewport, der gegen
   horizontales Scrollen prüft.

**Aufwand:** ~1 h Layout-Fix + 30 min E2E-Smoke. Backlog Feature D5
(Komponenten-DRY mit `<Button>`-Primitive + Toolbar-Component) wäre
der saubere Ort, das gleich richtig zu machen.

---

### G. Detail-Beobachtungen aus der OG-Override-Session

Kleine Punkte, die beim Bauen aufgefallen sind und keinen
eigenen Feature-Block rechtfertigen.

**~~G1. „Vorschau anpassen"-Button in der Create-Erfolgs-Card~~** — umgesetzt
PreviewOverrideButton in [`app/components/CreateLinkForm.tsx`](app/components/CreateLinkForm.tsx)
direkt neben Copy + Share platziert. Frisch erstellte Links haben naturgemäß
keine Override-Werte, daher mit `null`/`0` initialisiert.

**~~G2. Race Condition beim Bild-Update~~** — entschärft
Defensiver `if (saving) return;`-Guard am Anfang von `handleSubmit` und
`handleResetImage` in [`PreviewOverrideButton`](app/components/PreviewOverrideButton.tsx).
Der Button selbst ist via `disabled={saving}` schon geschützt; der
Function-Guard schließt das React-Tick-Zeitfenster zwischen Click und
State-Update.

**~~G3. Dockerfile-HEALTHCHECK~~** — **umgesetzt**
HEALTHCHECK-Direktive in [`Dockerfile`](Dockerfile) ergänzt. Polling
auf `/api/health` alle 30 s, `start-period: 15s`, 3 Retries bis
Container als unhealthy gilt. Sliplane macht weiterhin sein eigenes
Healthchecking; Docker-CLI / Container-Orchestrator (z. B. lokal mit
docker run) sehen den Status jetzt auch.

**~~G4. ESLint 9 Flat-Config~~** — **umgesetzt**
[`eslint.config.mjs`](eslint.config.mjs) mit native Flat-Imports von
`eslint-config-next/core-web-vitals` und `eslint-config-next/typescript`.
`npm run lint` → `eslint .`. Im CI als 3. Schritt (zwischen Install
und Typecheck) eingebaut. Beim ersten Lauf gefundene Issues alle
gefixt: 5× unescaped Entities, 3× setState-in-Effect (mit
Begruendungs-Kommentar disabled, gehoeren zum spaeteren D-Refactor),
1× Unused-Disable-Direktive in safeRedirect.ts entfernt.
`@typescript-eslint/no-unused-vars` mit `^_`-Pattern fuer absichtlich
ungenutzte Args konfiguriert.

**G5. npm audit: 9 moderate Warnings in transitiven Deps (Stand 2026-05-13)**
Drei Wurzel-Vulnerabilities, alle transitiv und im konkreten Use-Case
nicht ausnutzbar:

1. **`esbuild@0.18.20`** via `drizzle-kit > @esbuild-kit/esm-loader >
   @esbuild-kit/core-utils` ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99))
   — Dev-Server CORS-Bypass. `drizzle-kit` laeuft nur lokal via
   `npm run db:generate`; kein Dev-Server, keine Production-Exposure.
   `@esbuild-kit/*` ist archiviert, kein Upstream-Fix in Sicht.
   `drizzle-kit@latest` ist bereits 0.31.10 (= unsere Version).
2. **`postcss@8.4.31`** in `next@16.2.6` intern gebundelt
   ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93))
   — XSS via unescaped `</style>` im CSS-Stringify-Output. Wir
   produzieren kein CSS aus User-Input. Direkte `postcss`-Dep ist
   bereits 8.5.14 (sicher).
3. **`ip-address@5.9.4`** via `geoip-lite@1.4.10`
   ([GHSA-v2v4-37r5-5v8g](https://github.com/advisories/GHSA-v2v4-37r5-5v8g))
   — XSS in `Address6` HTML-emitting methods. Wir nutzen nur
   `geoip.lookup(ip).country`; HTML-Methoden werden nirgends
   aufgerufen.

**Warum nicht `npm audit fix --force`?** Schlaegt Major-Downgrades vor
(drizzle-kit → 0.18.1, next → 9.3.3, geoip-lite → 1.2.2), wuerde die
App brechen.

**Naechster Check:** nach `npm update`, spaetestens bei naechstem
Major-Update einer der drei Wurzel-Deps (drizzle-kit, next, geoip-lite).
Falls Dependabot grun werden soll: `overrides` in package.json setzen
— riskant, separate Session.

---

## ~~1. Ablaufdatum für Tracking-Links~~ (umgesetzt)

Implementiert in [`lib/ttl.ts`](lib/ttl.ts), `CreateLinkForm` (Selector mit
7 Presets + „Kein Ablauf"), `/api/create` (TTL → `expires_at`),
`/t/[id]` (HTTP 410 mit gebrandeter Hinweisseite), Dashboard-Filter
(Default nur aktive, Toggle „Abgelaufene anzeigen").

---

## ~~2. Vorlagen-Tab~~ (umgesetzt)

Implementiert in [`db/schema.ts`](db/schema.ts) (Tabelle `templates`),
Server-Actions `createTemplate` / `deleteTemplate` / `useTemplate` in
[`app/actions.ts`](app/actions.ts), Admin-Seite `/admin/templates` mit
Add-Form + Delete-Confirm, User-Seite `/templates` mit „Link erzeugen"
pro Vorlage und Inline-Erfolgs-Card mit OG-Preview + Copy-Button.
Link-Erzeugung läuft über den neuen Helper
[`lib/createTrackingLink.ts`](lib/createTrackingLink.ts), der auch von
`/api/create` genutzt wird.

---

## ~~3. Share-Buttons~~ (umgesetzt)

Implementiert in [`app/components/ShareButton.tsx`](app/components/ShareButton.tsx)
als Client-Komponente mit Dropdown (WhatsApp, E-Mail, Telegram, LinkedIn,
X / Twitter, SMS) plus optionalem „Über System teilen"-Eintrag, wenn
`navigator.share` verfügbar ist. Eingebunden in Dashboard-Liste,
Erstellungs-Erfolgs-Card (CreateLinkForm) und Templates-Erfolgs-Card.
Geteilt wird ausschließlich die nackte URL ohne Begleittext.

---

## ~~5. Google Safe Browsing~~ (umgesetzt)

Implementiert in [`lib/safeBrowsing.ts`](lib/safeBrowsing.ts) als
optional einsetzbarer Helper. Aktiv, wenn ENV `GOOGLE_SAFE_BROWSING_API_KEY`
gesetzt ist; sonst No-Op (graceful degradation). Eingebunden in
[`lib/createTrackingLink.ts`](lib/createTrackingLink.ts) nach Block-Liste
und vor OG-Fetch — Treffer (Phishing, Malware, Unwanted Software,
Potentially Harmful Application) → `TrackingLinkError` 403 mit Klarnamen.
Service-Fehler (HTTP, Netzwerk, Timeout) sind fail-open: der Workflow
wird nicht blockiert, wenn Google gerade nicht erreichbar ist.

---

## ~~6. Adult-Content-Filter~~ (umgesetzt)

Implementiert via Hostliste aus
[StevenBlack/hosts (porn-only)](https://github.com/StevenBlack/hosts/tree/master/alternates/porn-only).
Liste committed unter
[`lib/blocklists/adult-hosts.txt`](lib/blocklists/adult-hosts.txt)
(~64k einzigartige Hosts, ~2 MB). [`lib/adultFilter.ts`](lib/adultFilter.ts)
lädt die Datei lazy beim ersten Lookup, dedupliziert in einem `Set` und
prüft nicht nur den exakten Host, sondern auch alle Eltern-Domains
(`subdomain.bad.example` matcht über `bad.example`).

Eingebunden in
[`lib/createTrackingLink.ts`](lib/createTrackingLink.ts) nach der
Block-Liste und vor Safe Browsing. Treffer → `TrackingLinkError` 403.

Ins Standalone-Bundle eingeschleust via `outputFileTracingIncludes`
in [`next.config.mjs`](next.config.mjs), damit Sliplane die Datei zur
Laufzeit findet. Aktualisierung via
[`scripts/update-adult-hosts.sh`](scripts/update-adult-hosts.sh).

---

## ~~4. Vorlagen-Resolver~~ (umgesetzt)

Implementiert in [`lib/resolveTemplateUrl.ts`](lib/resolveTemplateUrl.ts)
als Helper, der die Quell-URL lädt, alle `href`-Werte extrahiert,
relative URLs gegen die Quelle absolutisiert, dedupliziert und den
ersten Regex-Treffer als Ziel-URL liefert.

- `templates.url_pattern` als optionale Spalte in
  [`db/schema.ts`](db/schema.ts) plus `ensureColumn`-Migration.
- `useTemplate`-Action ruft den Resolver, wenn ein Pattern hinterlegt ist.
- `testTemplatePattern`-Action für den Live-Test im Admin-UI.
- [`app/admin/templates/TemplateForm.tsx`](app/admin/templates/TemplateForm.tsx)
  als Client-Form mit Pattern-Feld und „Auflösen testen"-Button, der
  bei Erfolg die ermittelte URL in Grün und bei Fehlschlag die ersten
  10 Kandidaten in Bernstein anzeigt.
- Vorlagen mit Pattern bekommen ein „Tagesaktuell"-Badge in
  [`/templates`](app/templates/page.tsx) und ein „Resolver"-Badge plus
  Pattern-Anzeige in der Admin-Liste.

Live verifiziert mit beiden Beispiel-Quellen (Bibelliga, Bibelpraxis):
beide liefern korrekt die heutige Detail-URL.
