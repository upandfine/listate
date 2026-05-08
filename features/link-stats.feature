# language: de
Feature: Statistik-Detailseite eines Links
  Als angemeldeter Nutzer (oder Admin)
  möchte ich für einen meiner Links sehen, wann und wie oft er geklickt
  wurde, damit ich Reichweite und Timing meiner Beiträge einordnen kann.

  Background:
    Given ich bin als "user@example.com" angemeldet
    And mein Link "abc123" hat 42 Klicks in den letzten 30 Tagen

  Scenario: Drei Kennzahlen oben
    When ich "/links/abc123" aufrufe
    Then sehe ich drei Stat-Cards:
      | Label                | Wert                                |
      | Klicks insgesamt     | aller Klicks                        |
      | Letzte 30 Tage       | Summe der letzten 30 Tage           |
      | Letzte 7 Tage        | Summe der letzten 7 Tage            |

  Scenario: 30-Tage-Bar-Chart
    Then sehe ich einen Balken-Chart mit 30 Tages-Säulen
    And jeder Balken hat einen Tooltip "Datum: N Klicks"
    And jeder fünfte Balken hat ein Datums-Label

  Scenario: Heatmap 7×24
    Then sehe ich eine Heatmap mit 7 Zeilen (So-Sa) und 24 Spalten
    And ein Tooltip pro Zelle "Tag HH:00 – N Klicks"
    And der Top-Slot wird als Satz unten angezeigt

  Scenario: Letzte 30 Klicks chronologisch
    Then sehe ich eine Liste mit bis zu 30 Klick-Zeitstempeln, neueste zuerst

  Scenario: Aktionen funktionieren auch hier
    Then sehe ich Copy-, Share- und QR-Button für die Tracking-URL

  Scenario: Fremde Statistik nicht zugänglich
    Given es existiert ein Link "xyz999", den jemand anderer besitzt
    When ich "/links/xyz999" aufrufe
    Then sehe ich eine 404-Seite und keine Daten

  Scenario: Admin sieht jede Statistik
    Given ich bin als Admin angemeldet
    And es existiert ein Link "xyz999", der einer anderen Person gehört
    When ich "/links/xyz999" aufrufe
    Then sehe ich die normale Statistik-Detailseite
    And zusätzlich den Owner ("von <email>") in den Meta-Daten

  Scenario: Leerzustand
    Given ein neuer Link mit 0 Klicks
    When ich seine Statistikseite öffne
    Then sehe ich überall "0" und Platzhalter-Texte ("Noch keine Klicks…")
    And keine kaputten Charts
