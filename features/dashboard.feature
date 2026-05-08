# language: de
Feature: Dashboard
  Als angemeldeter Nutzer
  möchte ich meine Tracking-Links übersichtlich verwalten,
  filtern, durchsuchen und sortieren können.

  Background:
    Given ich bin als "user@example.com" angemeldet
    And ich habe 35 Links angelegt
    And einige Links sind abgelaufen, einige haben Tags und Slugs

  Scenario: Default-Ansicht zeigt nur aktive Links
    When ich "/dashboard" aufrufe
    Then sehe ich nur Links, deren expires_at NULL ist oder in der Zukunft liegt
    And der Subheader sagt "X Links" (ohne "inkl. abgelaufener")

  Scenario: Toggle „Abgelaufene anzeigen"
    When ich die Checkbox "Abgelaufene anzeigen" aktiviere
    And auf "Anwenden" klicke
    Then erscheinen auch abgelaufene Links, gedimmt mit rotem "abgelaufen"-Badge
    And der Subheader sagt "… inkl. abgelaufener"

  Scenario Outline: Sortierung
    When ich Sortierung "<sort>" wähle und anwende
    Then sehe ich die Links sortiert nach "<feld>"

    Examples:
      | sort               | feld                                                |
      | Neueste zuerst     | created_at absteigend                               |
      | Meiste Klicks      | click_count absteigend, created_at absteigend       |
      | Alphabetisch       | og_title aufsteigend, fallback auf original_url     |

  Scenario: Pagination
    Given ich habe 60 Links
    When ich "/dashboard" aufrufe
    Then sehe ich genau 25 Links auf Seite 1
    And eine Pagination-Leiste „Seite 1 von 3"
    When ich auf "Nächste →" klicke
    Then bin ich auf "/dashboard?page=2"
    And sehe die Links 26-50

  Scenario: Volltextsuche
    Given ich habe einen Link mit Titel "IT-Leadership Trainings"
    When ich im Suchfeld "leadership" eingebe und anwende
    Then erscheint nur der Link mit dem passenden Titel
    And der Subheader zeigt 'Suche: "leadership"'

  Scenario: Tag-Filter
    Given ein Link hat den Tag "newsletter"
    When ich auf den "#newsletter"-Pill klicke
    Then werden nur Links mit diesem Tag angezeigt
    And der Pill ist hervorgehoben

  Scenario: Tag-Filter wieder entfernen
    Given der Filter "Tag: newsletter" ist aktiv
    When ich oben auf "× newsletter" klicke
    Then ist der Filter aufgehoben und alle Links sind wieder sichtbar

  Scenario: Sparkline pro Link
    Given mein Link hat in den letzten 14 Tagen sporadische Klicks
    When ich das Dashboard öffne
    Then sehe ich neben dem Klick-Counter eine 14-Tage-Sparkline
    And der letzte Punkt ist mit dem Akzent-Rot markiert

  Scenario: Klick auf Klick-Zähler öffnet Statistik
    When ich im Dashboard auf den Klick-Counter eines Links klicke
    Then werde ich nach "/links/<id>" weitergeleitet
