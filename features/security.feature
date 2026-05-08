# language: de
Feature: Sicherheits-Filter beim Erstellen
  Listate setzt mehrere Schichten ein, um Missbrauch und unsicherem
  Content beim Anlegen von Tracking-Links vorzubeugen:
  Block-Liste → Adult-Filter → Safe Browsing.

  Background:
    Given ich bin als "user@example.com" angemeldet

  Scenario Outline: URL-Validierung beim Erstellen
    When ich versuche, einen Link für "<url>" anzulegen
    Then antwortet die API mit "<status>" und "<message>"

    Examples:
      | url                                  | status | message                                                                |
      | (leer)                               | 400    | Nur https-URLs sind erlaubt.                                            |
      | http://example.com                   | 400    | Nur https-URLs sind erlaubt.                                            |
      | not-a-url                            | 400    | Nur https-URLs sind erlaubt.                                            |
      | javascript:alert(1)                  | 400    | Nur https-URLs sind erlaubt.                                            |

  Scenario: Block-Liste greift
    Given der Admin hat "spam.test" mit Grund "Phishing" geblockt
    When ich versuche, einen Link für "https://www.spam.test/foo" anzulegen
    Then antwortet die API mit 403 und "Diese Domain ist gesperrt: Phishing"

  Scenario: Adult-Filter greift auf Subdomain
    Given die Hostliste enthält "pornhub.com"
    When ich versuche, einen Link für "https://subdomain.pornhub.com" anzulegen
    Then antwortet die API mit 403 und "Diese Domain ist als nicht-jugendfreier Inhalt gelistet…"

  Scenario: Safe Browsing greift bei Phishing-Treffer
    Given die ENV "GOOGLE_SAFE_BROWSING_API_KEY" ist gesetzt
    And Safe Browsing meldet einen SOCIAL_ENGINEERING-Treffer für "https://phish.test"
    When ich versuche, diesen Link anzulegen
    Then antwortet die API mit 403 und "…als unsicher eingestuft (Phishing)"

  Scenario: Safe Browsing fail-open bei Service-Fehler
    Given die ENV ist gesetzt aber der Endpoint antwortet mit 500
    When ich einen normalen Link anlege
    Then geht das durch (Service-Fehler blockt den Workflow nicht)

  Scenario: Rate-Limit greift nach 60 Links pro Stunde
    Given ich habe in der letzten Stunde 60 Links erstellt
    When ich Link Nr. 61 versuche
    Then antwortet die API mit 429 und Hinweis auf das Limit

  Scenario: Security-Header sind auf jeder Antwort gesetzt
    When ich eine beliebige Listate-Seite aufrufe
    Then enthält die Antwort folgende Header:
      | Header                          | Wert (Auszug)                                       |
      | Strict-Transport-Security       | max-age=63072000; includeSubDomains; preload        |
      | X-Content-Type-Options          | nosniff                                              |
      | X-Frame-Options                 | DENY                                                 |
      | Referrer-Policy                 | strict-origin-when-cross-origin                      |
      | Permissions-Policy              | camera=(), microphone=(), geolocation=()             |
      | Content-Security-Policy         | default-src 'self'; …                                |

  Scenario: Open-Redirect-Schutz bei callbackUrl
    When ich /login mit callbackUrl=https://evil.com aufrufe
    Then wird der Login-Submit auf "/" als Redirect-Ziel zurückfallen
    And NICHT auf evil.com weiterleiten

  Scenario: Health-Endpoint öffentlich
    When ich GET "/api/health" ohne Auth aufrufe
    Then antwortet der Server mit 200 und JSON {status:"ok",db:"ok",latencyMs:<n>}

  Scenario: Health-Endpoint reagiert auf DB-Fehler
    Given die DB ist nicht erreichbar
    When ich GET "/api/health" aufrufe
    Then antwortet der Server mit 503 und JSON {status:"error",reason:"…"}
