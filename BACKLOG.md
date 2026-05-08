# Backlog

Geplante Features. Konzeptphase – Details werden vor Implementierung
jeweils nochmal abgestimmt.

---

## Vorgemerkt für später

### A. Webhook bei jedem Klick

**Ziel:** Externe Systeme (Slack, n8n, eigene Endpoints) bei jedem
Tracking-Link-Klick informieren.

**Skizze:**
- Pro User optional eine Webhook-URL in den Settings hinterlegbar.
- `/t/[id]` POSTet asynchron (fire-and-forget) ein JSON-Payload
  `{ linkId, slug, originalUrl, clickedAt, userAgent? }` an die URL.
- Optional: Signatur via `X-Listate-Signature` (HMAC-SHA256 mit
  Webhook-Secret pro User), damit Empfänger validieren können.
- Retries: 1× Wiederholung bei 5xx; sonst silent fail (kein User-Feedback).
- Rate-Limit: max 1 Webhook-Call pro Klick, kein Buffering nötig
  bei dem erwarteten Volumen.

**Offene Fragen:**
- Für welche Klicks? Nur Nicht-Crawler (= konsistent zu click_count)
  oder alle? Vermutlich erstere.
- Per-Link-Webhook oder pro User-Account? Pro User reicht für jetzt.

### B. Geo-Tracking (datenschutzfreundlich)

**Ziel:** Aggregierte Geo-Information (Land/Region) zu Klicks, ohne
personenbezogene IPs zu speichern.

**Skizze:**
- Bei jedem Nicht-Crawler-Klick die anfragende IP gegen eine
  GeoIP-Datenbank (MaxMind GeoLite2 lokal oder ipinfo.io API) auflösen.
- **Nur das Ergebnis** (z. B. `country: 'DE', region: 'BW'`) im
  `clicks`-Eintrag speichern. IP wird nicht persistiert.
- Klick-Detailseite zeigt zusätzlich „Top-Länder/Regionen" als Liste.
- Admin-Stats: Welt-Heatmap pro Land.

**DSGVO-Punkte:**
- Datenschutzerklärung muss erweitert werden:
  „Beim Aufruf wird die IP-Adresse einmalig gegen eine
   Geolocation-Datenbank aufgelöst und ausschließlich Land/Region
   gespeichert. Die IP-Adresse selbst wird nicht persistiert."
- Rechtsgrundlage: Art. 6 (1) f) DSGVO, berechtigtes Interesse an
  aggregierten Reichweitenstatistiken.
- AVV mit ipinfo.io o. Ä. nötig falls externe API; mit GeoLite2
  lokal entfällt das.

**Schema-Skizze:**
- `clicks.country TEXT NULL`, `clicks.region TEXT NULL`.

**Implementierungs-Empfehlung:** GeoLite2 lokal (kostenlos für
Non-Commercial, monatliches Update via Skript) → keine externe
Abhängigkeit, keine Drittlands-Übermittlung.

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
