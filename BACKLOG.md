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
- Reihenfolge im Dropdown: WhatsApp, E-Mail, Telegram, LinkedIn, X, SMS.
