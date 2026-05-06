# LinkTracker

Selbst gehostetes Link-Tracking-Tool: URL eingeben → Kurzlink mit
Open-Graph-Vorschau erhalten. Beim Aufruf wird ein Klick gezählt und
der Nutzer auf die Original-URL weitergeleitet, während Crawler
(WhatsApp, Slack, LinkedIn …) die OG-Tags der Originalseite sehen.

## Stack

- Next.js 14 (App Router) + TypeScript
- SQLite via `better-sqlite3` (persistent über Docker-Volume)
- `open-graph-scraper` für serverseitiges OG-Fetching
- Tailwind CSS
- Deployment als Docker-Container (z. B. auf Sliplane)

## Lokale Entwicklung

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

App läuft auf <http://localhost:3000>. Die SQLite-Datei wird unter
`./data/links.db` angelegt.

## Endpunkte

| Methode | Pfad           | Beschreibung                                              |
|---------|----------------|-----------------------------------------------------------|
| POST    | `/api/create`  | Erstellt einen Link inkl. OG-Daten, gibt Tracking-URL zurück |
| GET     | `/api/links`   | Liste aller Links (für Dashboard)                          |
| GET     | `/t/[id]`      | Tracking-Endpoint: zählt Klick + HTML mit OG-Tags + Redirect |

## Docker

```bash
docker build -t linktracker .
docker run -p 3000:3000 \
  -v linktracker-data:/app/data \
  -e NEXT_PUBLIC_BASE_URL=http://localhost:3000 \
  linktracker
```

## Sliplane

1. Repository verbinden, Build aus dem `Dockerfile`.
2. Persistentes Volume auf `/app/data` mounten.
3. Umgebungsvariablen setzen:
   - `NEXT_PUBLIC_BASE_URL=https://deine-domain.sliplane.app`
   - `DB_PATH=/app/data/links.db`
4. App-Port: `3000`.

## Backups

Die SQLite-Datei `links.db` regelmäßig sichern (z. B. via
Volume-Snapshot oder Cron). Mehr braucht es nicht.
