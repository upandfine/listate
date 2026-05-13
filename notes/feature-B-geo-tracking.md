# Feature B — Geo-Tracking (DSGVO-konform)

Ziel: Pro Klick erfassen, **aus welchem Land** der Aufruf kam. Niemals
volle IP, niemals Stadt/Postleitzahl. Land-Code reicht.

## Backlog-Kontext

Aus `BACKLOG.md` Sektion B:
> Pro Klick wird die IP nicht roh gespeichert. Stattdessen wird das
> Herkunftsland (Country-Code, z. B. „DE", „CH") aus der IP abgeleitet
> und nur dieses in der DB abgelegt. So bleibt DSGVO-konform.

## Optionen fuer die Geo-Lookup-Quelle

| | Vorteil | Nachteil |
|---|---|---|
| **`geoip-lite`** (npm) | Self-contained, ~6 MB Daten im Bundle, MIT-Lizenz, ZERO Setup | Daten ggf. veraltet (Update via `npm install geoip-lite` neu) |
| **`maxmind`** (npm) + GeoLite2 `.mmdb` | Genaueste freie Daten, frequent updates | Datei muss extern beschafft werden (MaxMind-Account + License-Key), Update-Skript noetig, ~70 MB |
| **`@maxmind/geoip2-node`** | Modernes API | Wie oben |
| **Externer Service** (ipapi.co, ipstack, …) | Immer aktuell, kein Self-Hosting | Externer Call pro Klick — Performance + Privacy schlechter, plus DSGVO-Vertragsanforderung |

**Empfehlung: `geoip-lite`.** Gruende:
- Single-Instance-Deploy auf Sliplane braucht keinen externen Dienst.
- Daten-Aktualitaet ist bei Land-Granularitaet unkritisch (Laender-IP-
  Ranges aendern sich selten).
- 0 Setup-Aufwand fuer User-Onboarding.
- ~6 MB Bundle ist OK fuer ein Server-Side-Modul (Next standalone).

**Hinweis:** Falls der User MaxMind bevorzugt (z. B. wegen lizenzkonformer
Updates), nur die `lib/geo.ts`-Implementation austauschen — das
Interface bleibt gleich.

## Datenfluss

1. Tracking-Endpoint `/t/[id]` faengt Crawler-Bot vs. echter-User
   bereits ab (siehe `app/t/[id]/route.ts::isCrawler`).
2. Beim Non-Crawler-Click:
   - IP aus `x-forwarded-for` (Sliplane setzt das) oder
     `req.headers.get('x-real-ip')` ableiten.
   - `geoip.lookup(ip)?.country` → 2-Letter-Country-Code oder `null`.
   - In `clicks`-Tabelle schreiben (jetzt mit zusaetzlicher Spalte
     `country_code TEXT`).
3. IP wird **nirgends** persistiert oder geloggt.

## Schema-Aenderung

`clicks`-Tabelle bekommt eine neue Spalte:

```sql
ALTER TABLE clicks ADD COLUMN country_code TEXT;
CREATE INDEX idx_clicks_country_code ON clicks(country_code);
```

Update in den drei Synchron-Stellen:
1. `db/schema.ts::clicks` — `countryCode: text('country_code')`
2. `db/index.ts::bootstrap()` — `ensureColumn(sqlite, 'clicks', 'country_code', 'TEXT')` + `CREATE INDEX IF NOT EXISTS`
3. `tests/utils/db.ts` — `CREATE TABLE clicks ... country_code TEXT`

## Konkrete Aufgaben-Reihenfolge

### Etappe 1: lib/geo.ts mit Tests (~30 min)

- `npm install geoip-lite @types/geoip-lite`
- Neuer Helper `lib/geo.ts`:
  ```ts
  export function lookupCountry(ip: string | null): string | null
  export function extractClientIp(headers: Headers): string | null
  ```
- `lookupCountry`: trim, ipv6-zu-ipv4-mapping (`::ffff:1.2.3.4` → `1.2.3.4`),
  geoip.lookup, 2-Letter ISO-Code zurueckgeben.
- `extractClientIp`: Reihenfolge `x-forwarded-for` (erstes IP), `x-real-ip`.
  Loopback (`127.0.0.1`, `::1`) → null.
- Unit-Tests in `tests/unit/geo.test.ts` mit `vi.mock('geoip-lite')`.

### Etappe 2: Schema-Migration (~15 min)

- 3 Files synchron updaten (siehe oben).
- Manuelle Migration-Test auf Legacy-DB (siehe vorheriges Pattern in
  `BACKLOG.md`).

### Etappe 3: /t/[id] integration (~30 min)

- In `app/t/[id]/route.ts` beim Non-Crawler-Insert die IP extrahieren,
  lookup, country_code mit in den Click-Insert nehmen.
- Integration-Test in `tests/integration/t-route.test.ts` erweitern:
  Geo-Mock auf bestimmte IP → bestimmtes Land → Eintrag in `clicks` mit
  korrektem `country_code`.

### Etappe 4: Aggregations-Helper + Stats-UI (~1 h)

- `lib/clickStats.ts` erweitern um `getCountryBreakdown(db, linkId, days)`:
  liefert `Array<{ country: string; count: number }>` sortiert nach
  count desc.
- Detail-Seite (`app/links/[id]/page.tsx`): neue Sektion „Herkunft" mit
  Top-10-Liste oder einfachem Balken.
- Optional: Admin-Stats (`/admin/stats`) bekommt ein „Top-Laender"-
  Widget.

### Etappe 5: Export + Tests (~30 min)

- `/api/export` (DSGVO Art. 20) muss `country` mit ausgeben — der
  User soll seine Geo-Daten ueber sich selbst sehen.
- Tests fuer den Aggregations-Helper (mit gemockten Daten in 2-3
  Laendern).

### Etappe 6: BACKLOG-Update + Commit + Push (~10 min)

- B als umgesetzt markieren.
- Push, CI gruen abwarten.

## DSGVO-Notes (wichtig!)

- IP **niemals** roh in der DB. Auch kein IP-Hash — der waere
  pseudonymisiert, aber wir brauchen ihn nicht.
- Country-Code allein gilt als nicht-personenbezogen, solange nicht
  zusaetzlich der Nutzer identifiziert wird. Da wir nur authenticated
  Owner sehen koennen, welche Laender ihre EIGENEN Tracking-Links
  besuchen, ist das kein Personenbezug auf den Klicker.
- Datenschutz-Erklaerung in `/datenschutz` ergaenzen: Erwaehnen, dass
  Country aus IP abgeleitet wird, IP selbst nicht gespeichert wird.

## Edge-Cases

- **Localhost-IP** (Dev-Mode): `lookupCountry` liefert `null`, kein
  Crash.
- **Proxy-Chain in `x-forwarded-for`**: nur die erste IP (Client) nehmen,
  Rest verwerfen.
- **IPv6**: geoip-lite unterstuetzt IPv6, sollte funktionieren.
- **Unbekannte IP** (Cloud-Range, VPN, neue Range): `country_code = null`
  — kein Fehler.

## Was zu vermeiden ist

- Kein externer API-Call pro Klick (Performance + DSGVO-Vertragsfrage).
- Keine IP-Speicherung, auch nicht „nur fuer 24h".
- Keine Stadt/PLZ — Land reicht und ist DSGVO-vertraeglich.

## Wenn du loslegst

Lies zuerst `CLAUDE.md` fuer die allgemeinen Konventionen. Folge der
Etappen-Reihenfolge. Frag den User bei Lib-Wahl (geoip-lite vs.
MaxMind) noch einmal kurz nach, **bevor** du installierst — falls er
in der Zwischenzeit eine Praeferenz hat.
