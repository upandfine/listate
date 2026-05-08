# language: de
Feature: Tracking-Link erstellen
  Als angemeldeter Nutzer
  möchte ich aus einer beliebigen https-URL einen kurzen Tracking-Link
  erzeugen, damit ich Klicks zählen kann, ohne UTMs sichtbar zu kleben.

  Background:
    Given ich bin als "user@example.com" angemeldet
    And ich bin auf der Startseite "/"

  Scenario: Einfacher Link ohne Optionen
    When ich "www.upandfine.de" in das URL-Feld eingebe
    And auf "Erzeugen" klicke
    Then sehe ich eine Erfolgs-Card mit einem Tracking-Link in der Form "https://listate.de/t/<id>"
    And die Vorschau zeigt Titel, Bild und Beschreibung der Originalseite
    And ein Toast bestätigt "Tracking-Link erstellt"

  Scenario: Frontend strippt versehentliches https://
    When ich "https://www.upandfine.de" in das URL-Feld pasten
    Then erscheint im Eingabefeld nur "www.upandfine.de"
    And der Präfix "https://" bleibt links als grauer Block stehen

  Scenario Outline: TTL-Preset wird beim Erstellen gespeichert
    When ich "<host>" eingebe
    And TTL "<preset>" wähle
    And auf "Erzeugen" klicke
    Then ist der Link nach "<dauer>" abgelaufen
    And die Erfolgs-Card zeigt "läuft ab am <datum-pattern>"

    Examples:
      | host                     | preset      | dauer       | datum-pattern |
      | www.upandfine.de         | 2 Tage      | 2 Tagen     | …             |
      | www.lebenistmehr.de      | 1 Monat     | 30 Tagen    | …             |

  Scenario: Custom-Slug
    When ich Optionen aufklappe
    And als Slug "gottesdienst-19-5" eintrage
    And "www.upandfine.de" eingebe
    And auf "Erzeugen" klicke
    Then ist der Tracking-Link "https://listate.de/t/gottesdienst-19-5"

  Scenario: Slug-Konflikt wird sofort angezeigt
    Given ein anderer Link mit Slug "newsletter-mai" existiert bereits
    When ich denselben Slug "newsletter-mai" eintrage
    And auf "Erzeugen" klicke
    Then erscheint ein Toast mit "Slug „newsletter-mai" ist bereits vergeben."

  Scenario: Reservierte Slugs werden abgelehnt
    When ich als Slug "admin" eintrage
    And auf "Erzeugen" klicke
    Then erscheint ein Toast mit „„admin" ist reserviert"

  Scenario: Tags werden normalisiert
    When ich Tags "Newsletter, PREDIGT, mai 2026, " eintrage
    And einen Link erstelle
    Then werden die gespeicherten Tags zu "newsletter,predigt,mai-2026"

  Scenario: Rate-Limit greift bei zu vielen Links
    Given ich habe in der letzten Stunde bereits 60 Links erstellt
    When ich einen weiteren Link anlege
    Then erhalte ich HTTP 429
    And ein Toast mit "Du hast in der letzten Stunde 60 Links erstellt – das ist die aktuelle Obergrenze."

  Scenario: http-URL wird abgelehnt
    Given ich rufe POST /api/create direkt mit "{ url: 'http://example.com' }" auf
    Then antwortet die API mit 400 und "Nur https-URLs sind erlaubt."

  Scenario: Anonymer Aufruf von /api/create wird abgelehnt
    Given ich bin nicht angemeldet
    When ich POST /api/create mit gültigem Body aufrufe
    Then antwortet die API mit 401 und "Nicht angemeldet"
