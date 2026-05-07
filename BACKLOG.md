# Backlog

Geplante Features. Konzeptphase – Details werden vor Implementierung
jeweils nochmal abgestimmt.

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

## 4. Vorlagen-Resolver (URL aus Übersichtsseite extrahieren)

**Ziel:** Bei Quellseiten, die den heutigen Inhalt als Karte in einer
Übersicht zeigen (z. B. Bibelliga „Vers des Tages", bibelpraxis.de
„Täglicher Bibel-Impuls"), automatisch die heutige Detail-URL ermitteln
statt nur die statische Übersicht zu speichern.

### Funktionsweise
- Neue Spalte `templates.url_pattern TEXT NULL`. Wenn leer → bisheriges
  Verhalten (URL statisch).
- Beim Klick auf „Link erzeugen":
  1. Listate lädt `source_url`,
  2. extrahiert per Regex alle `href="…"`-Werte aus dem HTML,
  3. dedupliziert auf eindeutige URLs (Reihenfolge bleibt),
  4. nimmt den **ersten Treffer**, der dem `url_pattern` entspricht,
  5. legt darauf einen ganz normalen statischen Tracking-Link an.
- Bei keinem Match: klare Fehlermeldung mit den ersten ~10 Kandidaten,
  damit der Admin sein Pattern verfeinern kann.

### Beispiel-Konfigurationen
```
Bibelliga
  source_url:   https://www.bibelliga.org/vers-des-tages/
  url_pattern:  ^https://www\.bibelliga\.org/vers-des-tages-[^/]+/$

Bibelpraxis
  source_url:   https://www.bibelpraxis.de/podcasts/1.html
  url_pattern:  ^https://www\.bibelpraxis\.de/a\d+\.html$

Lebenistmehr (kein Resolver, statisch)
  source_url:   https://www.lebenistmehr.de/leben-ist-mehr.html
  url_pattern:  (leer)
```

### UI-Erweiterung im Admin
- Optionales Feld „Link-Pattern (Regex)" im Vorlagen-Form.
- **„Auflösen testen"-Button** rechts daneben: lädt Quellseite einmal,
  zeigt sofort entweder „→ würde ergeben: `<URL>`" oder
  „Kein Match. Kandidaten: …". Vermeidet Trial-and-Error im User-Flow.

### Grenzen
- Funktioniert nur, wenn der heutige Inhalt **oben** in der Übersicht
  steht (was bei beiden geprüften Beispielen der Fall ist).
- Bricht, wenn Quellseite ihr URL-Schema ändert → Pattern muss neu
  gesetzt werden. Mit „Auflösen testen" in 30 Sekunden behebbar.
- JS-gerendete Seiten ohne SSR liefern leeres HTML → kein Match. In
  dem Fall ist die Quelle eh kein guter Kandidat fürs Tracking.

### Verworfen
- **RSS/Atom-Feed parsen** statt HTML. Pro: garantiert sortiert.
  Con: nicht jede Seite hat Feed, Code-Pfade verdoppeln sich,
  Nutzen marginal.
- **CSS-Selector-basierter Resolver.** Pro: präziser. Con: braucht
  cheerio/JSDOM, mehr Code, Admin muss CSS verstehen.
