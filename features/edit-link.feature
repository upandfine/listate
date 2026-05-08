# language: de
Feature: Bestehenden Tracking-Link bearbeiten
  Als angemeldeter Nutzer
  möchte ich Original-URL, Slug, Tags und Ablauf eines Links nachträglich
  ändern können, ohne den Klick-Verlauf zu verlieren.

  Background:
    Given ich bin als "user@example.com" angemeldet
    And ich besitze einen Link mit Tracking-URL "https://listate.de/t/abc123"
    And der Link zeigt aktuell auf "https://www.upandfine.de"
    And der Link hat 17 Klicks

  Scenario: Tags und Slug ändern, URL bleibt
    When ich im Dashboard auf "Bearbeiten" für diesen Link klicke
    And als Slug "blog-mai" eintrage
    And als Tags "newsletter, mai-2026" setze
    And auf "Speichern" klicke
    Then zeigt das Dashboard die aktualisierten Werte
    And die Klickzahl bleibt bei 17

  Scenario: URL ändern lädt OG frisch
    When ich die Original-URL auf "https://www.lebenistmehr.de" ändere
    And auf "Speichern" klicke
    Then zeigt die Karte die neue OG-Vorschau (Titel/Bild) der neuen Domain
    And die Klickzahl bleibt bei 17

  Scenario: Slug-Konflikt mit anderem Link
    Given ein anderer Link mit Slug "neu-slug" existiert
    When ich versuche meinen Link auf Slug "neu-slug" zu setzen
    Then erscheint ein Toast "Slug „neu-slug" ist bereits vergeben."
    And der bisherige Slug bleibt erhalten

  Scenario: Eigener Slug zählt nicht als Konflikt
    Given mein Link hat aktuell den Slug "mein-slug"
    When ich erneut denselben Slug speichere
    Then geht das durch (kein „bereits vergeben"-Fehler)

  Scenario: Ablauf entfernen
    Given mein Link läuft am 15.06.2026 ab
    When ich „Ablauf entfernen" anhake und speichere
    Then hat der Link kein expires_at mehr
    And der Hinweis "läuft ab am …" verschwindet

  Scenario: Fremder Link kann nicht bearbeitet werden
    Given es existiert ein Link, der einer anderen Person gehört
    When ich versuche, dessen ID an updateLink zu schicken
    Then antwortet die Action mit "Keine Berechtigung."

  Scenario: Admin darf fremde Links bearbeiten
    Given ich bin als Admin angemeldet
    And es existiert ein Link, der einer anderen Person gehört
    When ich diesen Link bearbeite
    Then geht das durch
