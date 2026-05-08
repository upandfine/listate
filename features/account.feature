# language: de
Feature: Eigene Konto-Verwaltung (DSGVO)
  Als Nutzer
  möchte ich meine Daten exportieren oder mein Konto vollständig löschen
  können, um meine DSGVO-Rechte (Art. 17 und 20) wahrzunehmen.

  Background:
    Given ich bin als "user@example.com" angemeldet
    And ich habe 5 Tracking-Links angelegt
    And ich befinde mich auf "/settings"

  Scenario: Profil-Übersicht
    Then sehe ich meine E-Mail, meine Rolle und die Anzahl meiner Links

  Scenario: Datenexport (Art. 20)
    When ich auf "Daten herunterladen (JSON)" klicke
    Then bekomme ich eine JSON-Datei "listate-export-YYYY-MM-DD.json"
    And sie enthält Profil-Daten, alle meine Links und deren Klick-Historie

  Scenario: Konto löschen (Art. 17) – Bestätigung
    When ich auf "Konto löschen" klicke
    Then erscheint ein Modal mit Warnung über die 5 Links und die Endgültigkeit

  Scenario: Konto löschen (Art. 17) – Ausführung
    Given das Lösch-Modal ist offen
    When ich auf "Endgültig löschen" klicke
    Then werden mein User-Eintrag, alle meine Links und alle zugehörigen Klicks gelöscht (Cascade)
    And ich werde abgemeldet und nach "/login" weitergeleitet

  Scenario: Andere Nutzer sind unberührt
    Given ein anderer Nutzer hat eigene Links
    When ich mein Konto lösche
    Then bleiben die Links anderer Nutzer unverändert
