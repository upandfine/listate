# language: de
Feature: Anmeldung und Routenschutz
  Als Listate-Nutzer
  möchte ich mich sicher anmelden und meine Daten geschützt wissen,
  damit nur ich meine Tracking-Links sehe und verwalte.

  Background:
    Given die App ist live unter "https://listate.de"

  Scenario: Anonymer Besucher sieht die öffentliche Landing-Page
    Given ich bin nicht angemeldet
    When ich "/" aufrufe
    Then sehe ich die öffentliche Landing-Page mit dem Hero "Tracking-Links mit echter Vorschau"
    And einen Button "Mit Google anmelden & loslegen"

  Scenario: Anonymer Zugriff auf geschützte Route führt zu /login
    Given ich bin nicht angemeldet
    When ich "/dashboard" aufrufe
    Then werde ich nach "/login?callbackUrl=%2Fdashboard" weitergeleitet

  Scenario: Login mit Google
    Given ich bin nicht angemeldet
    And ich rufe "/login" auf
    When ich auf "Mit Google anmelden" klicke
    And erfolgreich bei Google authentifiziere
    Then werde ich zur Startseite weitergeleitet
    And mein Avatar erscheint im Header
    And "Neu", "Vorlagen", "Dashboard", "Einstellungen" sind im Menü sichtbar

  Scenario: Super-Admin-Erkennung über ENV
    Given die ENV "SUPER_ADMIN_EMAILS" enthält "schneider@upandfine.de"
    When ich mich erstmalig als "schneider@upandfine.de" einlogge
    Then bekomme ich automatisch die Rolle "admin"
    And das "Admin"-Badge erscheint neben meiner E-Mail im Header
    And ich sehe zusätzlich die Menüpunkte "Statistik" und "Blockliste"

  Scenario: Logout
    Given ich bin als "user@example.com" angemeldet
    When ich auf "Abmelden" klicke
    Then werde ich nach "/login" weitergeleitet
    And meine Session ist beendet

  Scenario: Open-Redirect-Schutz bei callbackUrl
    Given ich bin nicht angemeldet
    When ich "/login?callbackUrl=https%3A%2F%2Fevil.com" aufrufe
    Then nutzt das Login-Formular "/" als Redirect-Ziel und nicht die externe URL

  Scenario: Dev-Bypass nur lokal
    Given die ENV "DEV_AUTH_BYPASS" ist auf "true" gesetzt
    And NODE_ENV ist nicht "production"
    When ich "/login" aufrufe
    Then sehe ich einen zusätzlichen amber-farbigen Block "Lokale Entwicklung"
    And einen Button "🧪 Als dev@listate.local einloggen"

  Scenario: Dev-Bypass auf Production deaktiviert
    Given NODE_ENV ist "production"
    And die ENV "DEV_AUTH_BYPASS" wäre auf "true" gesetzt
    When ich "/login" aufrufe
    Then erscheint kein Dev-Login-Block
    And der Provider "dev-bypass" ist nicht im API-Bundle vorhanden
