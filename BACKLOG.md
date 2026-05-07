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

## 6. Adult-Content-Filter (offen, optional)

**Ziel:** Pornografische / NSFW-Inhalte am Anlegen hindern. Nicht durch
Safe Browsing abgedeckt — das ist ausschließlich Threat-Intel
(Phishing/Malware), keine Inhalts-Klassifikation.

**Optionen:**
- **Eigene Hostliste** aus einer kuratierten Quelle wie
  StevenBlack/hosts (Adult-Variante) als Datei im Repo, beim Bootstrap
  in Memory geladen, vor Insert per O(1)-Lookup gegen `parsed.hostname`
  geprüft. ~50k Einträge, ~1–2 MB. Kostenlos, gelegentlich
  aktualisierbar via Skript.
- **CleanBrowsing API / NextDNS API**: kommerzielle URL-Klassifikation
  inkl. Adult-Kategorie. Pflegeleichter, kostet ab Volumen.

**Empfehlung:** Nur bauen, wenn Listate sich öffentlich für externe
Nutzer öffnet. Im aktuellen Setup (eingeladene User mit Login + Admin-
Blockliste) ist das Risiko praktisch null und der False-Positive-
Aufwand (z. B. medizinische Inhalte, Wikipedia-Artikel) zu groß.

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
