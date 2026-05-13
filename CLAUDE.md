# CLAUDE.md — Onboarding fuer Claude-Code-Sessions

Diese Datei ist die zentrale Briefing-Quelle fuer jede neue Claude-Code-
Session in diesem Repo. Lies sie zuerst, bevor du Code anfasst. Sie
fasst zusammen, **was schon entschieden ist**, sodass du Konventionen
nicht neu erfindest.

## Projekt

**Listate** — selbst gehosteter Link-Tracker. URL eingeben → Kurz-Link
mit Open-Graph-Vorschau bekommen. Beim Aufruf wird ein Klick gezaehlt
und der Nutzer auf die Original-URL weitergeleitet, waehrend
Social-Crawler (WhatsApp, Slack, LinkedIn, …) die OG-Tags der
Originalseite sehen.

Production: Sliplane (Docker), Single-Instance, SQLite-Volume.
Domain: listate.de.

## Stack

- **Framework**: Next.js 16.2.6 (App Router, Turbopack, `output: 'standalone'`)
- **DB**: SQLite via `better-sqlite3`, Drizzle ORM, persistiert über
  Docker-Volume `/app/data/`
- **Auth**: Auth.js v5 (next-auth@5.0.0-beta), Google OAuth + Dev-Bypass
- **Validation**: Zod v4 (alle FormData-Inputs)
- **Testing**: Vitest (Unit/Integration) + Playwright (E2E)
- **Lint**: ESLint 9 Flat-Config, eslint-config-next + jsx-a11y-Regeln
- **TypeScript strict** + `noUnusedLocals/Parameters/ImplicitOverride/FallthroughCases`

## Aktive Konventionen

### Server-Actions

Jede Action liegt in `app/actions/{domain}.ts` und liefert
**`ActionResult`** zurueck:

```ts
type ActionResult<T = void> =
  | { ok: true }
  | { ok: true; data: T }
  | { ok: true; redirect: string }
  | { ok: false; error: string };
```

Pattern:

```ts
'use server';
import { parseFormData, actionOk, toActionFail, type ActionResult } from '@/lib/actionResult';
import { mySchema } from '@/lib/actionSchemas';
import { requireUser } from '@/lib/actionHelpers';

export async function myAction(formData: FormData): Promise<ActionResult> {
  try {
    const input = parseFormData(formData, mySchema);
    const user = await requireUser();
    // ... business logic
    return actionOk();
  } catch (err) {
    return toActionFail(err, 'myAction');
  }
}
```

- **Auth-Helper** (`lib/actionHelpers.ts`): `requireUser`, `requireAdmin`,
  `requireOwnedLink`. Werfen typisierte `AuthError`/`PermissionError`/
  `ValidationError`. `toActionFail` mappt sie automatisch auf
  `ActionResult.error`.
- **Zod-Schemas** zentral in `lib/actionSchemas.ts`. Pflichtfelder mit
  `.default('').refine((v) => v.length >= 1, '<Custom Msg>.')` —
  damit fehlende FormData-Felder die saubere Custom-Message bekommen.
- **Form-Action-Wrapper** (`<name>FormAction`) fuer
  `<form action={fn}>` in Server-Components, die `Promise<void>`
  erwarten. Nutzen `executeOrRedirect(result, context)`.

### OG-Override-Layer

`og_*`-Spalten bleiben Scraper-Werte, `custom_*` sind User-Overrides.
**Render** ueber `getDisplayOg(link)` aus `lib/displayOg.ts` — nicht
direkt `link.ogTitle` benutzen!

### Audit-Log

Destruktive und Admin-Aktionen werden in `audit_log` geloggt via
`logAuditEvent({ userId, action, targetId?, metadata? })` aus
`lib/auditLog.ts`. Action-Type ist eine String-Literal-Union
(`'link.deleted'`, `'host.blocked'`, etc.). Defensive — DB-Fehler
crashen den Aufrufer nicht.

### Rate-Limit

In-Memory-Sliding-Window in `lib/rateLimit.ts`. Pro Endpoint:
`checkRateLimit({ key: '<ns>:<userId>', ...READ_LIMITS.LINKS })`. Bei
Trigger HTTP 429 + Retry-After-Header.

### HTTP-Client-Abstraktion

`safeBrowsing` und `resolveTemplateUrl` akzeptieren optional einen
`http: HttpClient`-Parameter (default `globalThis.fetch`). Tests
injizieren einen Mock-Client direkt, statt `vi.stubGlobal`.

## Test-Patterns

### Unit-Tests (Vitest, `tests/unit/*.test.ts`)

Pure-Function-Helper. Kein DB, kein Auth-Setup.

### Integration-Tests (Vitest, `tests/integration/*.test.ts`)

Mit In-Memory-SQLite via `tests/utils/db.ts::createTestDb()`.
Mock-Pattern fuer DB + Auth:

```ts
const mocks = vi.hoisted(() => ({
  currentDb: null as null | unknown,
  session: null as null | { user: { id: string; role?: 'user' | 'admin' } | null },
}));

vi.mock('@/db', () => ({ getDb: () => mocks.currentDb }));
vi.mock('@/auth', () => ({ auth: vi.fn(async () => mocks.session) }));

beforeEach(() => {
  h = createTestDb();
  mocks.currentDb = h.db;
  // ...
});
```

Rate-Limit zwischen Tests resetten: `_resetRateLimitForTests()` aus
`lib/rateLimit.ts`.

### E2E-Tests (Playwright, `tests/e2e/*.spec.ts`)

Eigene Test-DB `data/e2e-test.db`, Port 3041, `DEV_AUTH_BYPASS=true`.
`globalSetup` leert Tabellen via SQL DELETE (**nicht** File-Delete — der
Dev-Server hat seine Connection beim Health-Check schon offen).

Login-Helper:

```ts
async function loginAsDevUser(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: /dev@listate\.local einloggen/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
```

## Schema-Migrationen

Hybrid-Modell:

1. **`bootstrap()` in `db/index.ts`** macht initiales Schema-Setup mit
   `CREATE TABLE IF NOT EXISTS` + `ensureColumn` (idempotent). Hier
   landen neue Tabellen/Spalten fuer **lokale Tests + Live-DB-Catch-Up**.
2. **Drizzle-Migrations** (`drizzle/`, via `npm run db:generate`)
   sind additiv ab Migration 0001. Werden nach bootstrap() von
   `getDb()` automatisch eingespielt.

Bei einer neuen Schema-Aenderung:

1. `db/schema.ts` ergaenzen (Drizzle-Definition).
2. `db/index.ts::bootstrap()` ergaenzen (raw SQL `CREATE TABLE IF NOT EXISTS`
   oder `ensureColumn`).
3. `tests/utils/db.ts` synchron halten.
4. `npm run db:generate -- --name <kurz_beschreibung>` (optional,
   wenn man die Aenderung als Drizzle-Migration tracken will).
5. Tests laufen lassen.

## Scripts

```bash
npm run dev            # Dev-Server auf :3000
npm run build          # Production-Build
npm run start          # Production-Server (nach Build)
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm test               # Vitest (Unit + Integration)
npm run test:watch     # Vitest interaktiv
npm run test:cov       # Vitest mit Coverage
npm run test:e2e       # Playwright headless
npm run test:e2e:ui    # Playwright UI-Mode
npm run analyze        # Bundle-Analyzer
npm run db:generate    # drizzle-kit generate (neue Migration)
npm run db:check       # drizzle-kit check (Drift-Check)
```

## CI-Gates

Beim `git push origin main` muessen ALLE bestehen:

1. Lint (`npm run lint`)
2. Typecheck (`npm run typecheck`)
3. Unit + Integration mit Coverage-Threshold 88+ % branches
4. Production Build
5. E2E (Playwright Chromium)

Sliplane deployt automatisch nach Push auf main.

## Git-Workflow

- **Conventional Commits NICHT zwingend**, aber klare Subjects (max
  72 Zeichen).
- **Co-Authored-By** am Ende jedes Commit-Messages:
  `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- **Commits via HEREDOC** an `git commit -m`, damit Formatierung sauber.
- **Push auf main direkt** — kein PR-Workflow eingerichtet, weil
  Single-Maintainer-Projekt.
- **Worktree-Pattern**: Claude arbeitet auf
  `.claude/worktrees/<branch>/`, das ist ein Git-Worktree von einem
  Branch (typischerweise `claude/<irgendwas>`). Main liegt im
  Repo-Root.

## Wichtige Files

| File | Was es enthaelt |
|---|---|
| `BACKLOG.md` | Was umgesetzt ist, was offen, mit Begruendungen |
| `features/*.feature` | 9 Gherkin-Specs (Behavior-Doku, nicht automatisiert) |
| `notes/` | Feature-Briefings fuer spaetere Sessions |
| `scripts/README.md` | Ops-Anleitung (Backup, Restore, Sliplane-Cron) |
| `drizzle/README.md` | Migrations-Workflow |
| `.env.local.example` | Alle Env-Variablen mit Default-Hinweisen |

## Bekannte Schwachstellen

- **Single-Instance-only**: Rate-Limit-Counter und (geplant)
  Webhook-Retry-Queue sind in-memory. Bei Multi-Instance-Deploy
  → Redis o.ae. noetig.
- **`'unsafe-inline'` in CSP**: pragmatisch fuer Next-Bootstrap + 
  /t/[id]-Redirect-Script. Nonce-Variante steht im Backlog (D8).
- **`useTemplate` heisst jetzt `applyTemplate`**: bei ESLint-React-Hook-
  Rule-Match wurde umbenannt. Falls du etwas Aehnliches umbenennen
  musst — Frontend-Imports und Tests ebenfalls anfassen.

## Wenn du etwas Neues anfaengst

1. Lies `BACKLOG.md` zum aktuellen Feature.
2. Falls vorhanden, lies `notes/feature-<X>-<topic>.md`.
3. Schreibe einen kurzen Plan (Schema-Aenderungen, neue Helper, neue
   Tests, UI-Anpassungen) und checke ihn mit dem User ab, bevor du
   loslegst, **wenn der Scope nicht eindeutig ist**.
4. Pro logischer Etappe einen Commit. CI muss gruen bleiben.
5. Push auf main, wenn alles steht.
6. BACKLOG.md aktualisieren — als umgesetzt markieren oder offene
   Punkte praezisieren.
