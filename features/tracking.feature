# language: de
Feature: Tracking-Endpoint /t/[id]
  Als Empfänger eines geteilten Links
  möchte ich beim Klick zur Originalseite kommen,
  als Crawler/Messenger sehe ich die OG-Vorschau der Originalseite.

  Background:
    Given es existiert ein Link mit ID "abc123" und URL "https://www.upandfine.de"

  Scenario: Echter Browser-Klick wird gezählt und weitergeleitet
    Given mein User-Agent ist Chrome auf macOS
    When ich "https://listate.de/t/abc123" aufrufe
    Then antwortet der Server mit HTTP 200
    And der Body enthält ein Inline-Script mit window.location.replace
    And der click_count wurde um 1 erhöht
    And ein neuer Eintrag liegt in der clicks-Tabelle mit aktuellem Zeitstempel

  Scenario: Crawler-User-Agent wird nicht gezählt
    Given mein User-Agent ist "WhatsApp/2.23"
    When ich "https://listate.de/t/abc123" aufrufe
    Then antwortet der Server mit HTTP 200
    And der Body enthält die OG-Tags der Originalseite
    And der click_count bleibt unverändert
    And kein Eintrag wird in clicks geschrieben

  Scenario: Slug statt ID
    Given mein Link hat den Slug "mein-newsletter"
    When ich "https://listate.de/t/mein-newsletter" aufrufe
    Then funktioniert der Aufruf identisch zu /t/<id>
    And der Klick wird dem korrekten Link zugeordnet

  Scenario: Unbekannte ID
    When ich "https://listate.de/t/unbekannt" aufrufe
    Then antwortet der Server mit HTTP 404 und "Link nicht gefunden"

  Scenario: Abgelaufener Link
    Given mein Link hat expires_at vor einer Stunde
    When ich "https://listate.de/t/abc123" aufrufe
    Then antwortet der Server mit HTTP 410 (Gone)
    And der Body enthält die gebrandete "Link abgelaufen"-Seite
    And kein Klick wird gezählt

  Scenario: OG-Tags werden für Crawler in Listate-HTML eingebettet
    Given mein Link hat ogTitle "Beispiel-Titel" und ogImage "https://example.com/i.png"
    When ein Crawler die Tracking-URL aufruft
    Then enthält der HTML-Head Meta-Tags
      | property        | content                       |
      | og:title        | Beispiel-Titel                |
      | og:image        | https://example.com/i.png     |
      | og:url          | https://www.upandfine.de      |
      | twitter:card    | summary_large_image           |

  Scenario: User-Input wird beim Rendern HTML-escaped
    Given ein Link mit Originalseite, deren ogTitle "<script>alert(1)</script>" enthält
    When ein Crawler die Tracking-URL aufruft
    Then erscheint im HTML "&lt;script&gt;alert(1)&lt;/script&gt;"
    And kein ausführbares Script wird gerendert
