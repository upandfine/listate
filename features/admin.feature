# language: de
Feature: Admin-Funktionen
  Als Super-Admin
  möchte ich Block-Listen pflegen, alle Links durchsuchen
  und aggregierte Statistiken einsehen.

  Background:
    Given ich bin als Admin "schneider@upandfine.de" angemeldet

  Scenario: Hosts blockieren mit Grund
    Given ich rufe "/admin/blocked" auf
    When ich Host "spam-domain.test" eintrage
    And als Grund "Phishing" angebe
    And auf "Host blockieren" klicke
    Then erscheint "spam-domain.test" in der Liste mit Grund "Phishing"

  Scenario: Hosts blockieren und bestehende Links mitlöschen
    Given Links zu "spam-domain.test" existieren bereits
    When ich diesen Host blockiere mit aktivierter Checkbox "Bestehende Links zu diesem Host gleich mitlöschen"
    Then sind alle bestehenden Links zu dieser Domain gelöscht

  Scenario: Block aufheben
    Given "spam-domain.test" ist gesperrt
    When ich auf "Aufheben" klicke und bestätige
    Then ist der Host nicht mehr gesperrt
    And bestehende Links bleiben unberührt

  Scenario: Hostname-Normalisierung
    Given ich blockiere "https://www.SpAm.test/anything"
    Then wird in der Tabelle "spam.test" gespeichert (lowercase, ohne www)

  Scenario: Aggregierte Admin-Statistik
    When ich "/admin/stats" aufrufe
    Then sehe ich KPIs für Nutzer, Links, Klicks gesamt, Klicks 30 Tage, Klicks 7 Tage
    And einen 90-Tage-Trend (Sparkline) über alle Klicks
    And eine 7×24-Heatmap über alle Klicks
    And eine Top-10-Domain-Tabelle nach Klicks
    And eine Top-10-User-Tabelle nach Klicks

  Scenario: Top-User klickbar zum Dashboard-Filter
    When ich auf einen Eintrag in der Top-Nutzer-Tabelle klicke
    Then werde ich nach "/dashboard?user=<userId>" weitergeleitet
    And sehe nur die Links dieses Users

  Scenario: Dashboard-Nutzer-Filter (Admin)
    Given mehrere Nutzer haben Links angelegt
    When ich "/dashboard" mit dem Filter "Nutzer: alice@example.com" anwende
    Then sehe ich nur die Links von Alice

  Scenario: Reguläre Nutzer haben keinen Zugriff auf /admin/*
    Given ich bin nicht-admin
    When ich "/admin/stats" aufrufe
    Then werde ich auf "/" weitergeleitet
