# Backlog

Geplante Features, noch nicht umgesetzt. Konzeptphase – Details werden vor
Implementierung jeweils nochmal abgestimmt.

---

## 1. Ablaufdatum für Tracking-Links

**Ziel:** Übersichtlichkeit erhöhen. Alte oder bewusst zeitlich begrenzte Links
verschwinden aus dem Dashboard, ohne dass sie gelöscht werden.

### Funktionsweise
- Beim Erstellen optionaler Ablauf wählbar. Presets:
  - **Tage:** 2, 5, 7
  - **Wochen:** 2, 4
  - **Monate:** 1, 3
  - „Kein Ablauf" (Default)
- Nach Ablauf bleibt der Link in der DB, ist aber **nicht mehr aktiv**:
  - `/t/[id]` liefert eine eigene **„Link abgelaufen"-Seite** mit HTTP 410 Gone.
  - Kein Redirect, kein Klick-Increment.
- Dashboard:
  - Default-View zeigt nur aktive Links.
  - Filter-Toggle „auch abgelaufene anzeigen".
- Endgültig löschen geht weiterhin über den bestehenden Trash-Button.

### Schema-Skizze
- Neue Spalte auf `links`: `expires_at TEXT NULL`.

### UI-Hinweis
- Im `CreateLinkForm` ein kompakter Selector unter dem URL-Feld.
  Default: „Kein Ablauf". Sieben Presets in einer kompakten Zeile,
  ggf. nach Einheit (Tage/Wochen/Monate) gruppiert.

---

## 2. Vorlagen-Tab

**Ziel:** Häufig genutzte URLs in einem Klick zu Tracking-Links machen, ohne
sie jedes Mal eintippen zu müssen. Besonders nützlich für tägliche Inhalte
wie Andachten, Tageslosungen, Newsletter-Archive.

### Funktionsweise
- Neuer Tab **„Vorlagen"** in der Header-Navigation neben Neu/Dashboard.
- Admin pflegt unter `/admin/templates` eine Liste mit:
  - Label (z. B. „Leben ist mehr – Tagesvers")
  - URL (**statisch**, z. B. `https://www.lebenistmehr.de/leben-ist-mehr.html`)
  - Optional: kurze Beschreibung
- User auf `/templates`: sieht alle Vorlagen, klickt „Listate-Link erzeugen"
  → ein normaler Tracking-Link wird mit der Template-URL angelegt und in
  die Liste des Users übernommen.
- **Wichtig — statische URL, keine Platzhalter-Logik.** Wenn die Zielseite
  selbst „heute" bestimmt (z. B. `*.html` ohne Parameter zeigt automatisch
  den aktuellen Tag), übernimmt das die Zielseite. Listate macht keine
  Datums-Substitution in der URL.

### Beispiele für Tages-/Wiederkehr-URLs
Zur Inspiration für sinnvolle Default-Vorlagen oder als Hilfe-Texte:
- `https://www.lebenistmehr.de/leben-ist-mehr.html` — Tagesvers (ohne Param
  = heute, `?datum=...` = älteres Datum)
- `https://www.losungen.de/die-tageslosung` — Herrnhuter Tageslosung
- Andachten-Portale, Predigt-Newsletter-Archive, Tagesgebete
- → Sammlung beim Konzept-Finalisieren noch erweitern

### Schema-Skizze
- Neue Tabelle `templates`: `id`, `label`, `original_url`, `description`,
  `created_at`, `created_by`.

### Entscheidungen
- **Nur Admin** pflegt Vorlagen (vorerst). User-eigene Pins kommen nicht
  in den ersten Wurf.
- **Vorschau analog zum normalen Erstell-Flow:** Beim Klick auf „Link
  erzeugen" wird OG geholt und gezeigt – derselbe Code-Pfad wie heute
  beim manuellen Eintragen.

---

## 3. Share-Buttons

**Ziel:** Tracking-Link in einem Klick in die üblichen Kanäle. Ergänzt den
bestehenden Kopieren-Button.

### Funktionsweise
- Neben dem Kopieren-Button (Erstellungs-Vorschau **und** Dashboard-Liste)
  ein zusätzlicher **„Teilen"-Button**.
- Geteilt wird **nur die nackte URL**, kein Begleittext.
- Mobile: `navigator.share()` (Web Share API) → System-Share-Sheet zeigt
  alle installierten Apps.
- Desktop: Dropdown mit Direkt-Links zu:
  - WhatsApp (`https://wa.me/?text=...`)
  - E-Mail (`mailto:?body=...`)
  - Telegram (`https://t.me/share/url?url=...`)
  - LinkedIn (`https://www.linkedin.com/sharing/share-offsite/?url=...`)
  - X / Twitter (`https://twitter.com/intent/tweet?url=...`)
  - SMS (`sms:?body=...`)

### Technik-Skizze
- Eigene Client-Komponente `ShareButton.tsx` analog zu `CopyButton.tsx`.
- Web-Share-Detection (`'share' in navigator`) mit Fallback auf
  Dropdown auf Desktop.
- Reihenfolge im Dropdown nach Häufigkeit der Nutzung sortieren –
  Default-Reihenfolge: WhatsApp, E-Mail, Telegram, LinkedIn, X, SMS.
