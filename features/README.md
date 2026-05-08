# Features (Gherkin-Specs)

Behavior-getriebene Beschreibung aller wichtigen User-Journeys. Dient
zwei Zielen:

1. **Lebende Doku** – wer neu reinschaut, sieht in lesbarem Deutsch,
   was die App leistet und unter welchen Bedingungen.
2. **Test-Vorlage** – jede Datei lässt sich später 1:1 in
   Cucumber/Playwright-BDD übernehmen, sobald die Test-Strategie
   (Backlog Feature E) umgesetzt wird.

## Konventionen

- **Sprache:** Deutsch. Schlüsselwörter wie `Feature`, `Scenario`,
  `Given`, `When`, `Then` bleiben englisch (Standard-Gherkin).
- **Eine Datei pro Top-Level-Feature.** Verwandte Szenarien in der
  gleichen Datei.
- **Acceptance-Kriterien aus Sicht der Persona**, nicht aus
  Implementierungs-Sicht. „Ich sehe einen Tracking-Link" ist gut,
  „eine Zeile in `links` wird inserted" ist schlecht.
- **Konkrete Beispieldaten** statt Pseudo-Variablen wo möglich.

## Aktuelle Datei-Übersicht

| Datei | User-Journey |
|---|---|
| [auth.feature](auth.feature) | Login (Google + Dev-Bypass), Logout, geschützte Routen |
| [create-link.feature](create-link.feature) | Tracking-Link erstellen mit allen Filtern und Optionen |
| [edit-link.feature](edit-link.feature) | Bestehenden Link bearbeiten |
| [tracking.feature](tracking.feature) | Klick auf einen Tracking-Link, Crawler-Vorschau, Ablauf |
| [dashboard.feature](dashboard.feature) | Dashboard inkl. Suche, Tags, Sortierung, Pagination |
| [link-stats.feature](link-stats.feature) | Statistik-Detailseite pro Link |
| [templates.feature](templates.feature) | Vorlagen-Verwaltung und -Nutzung, inkl. Resolver |
| [admin.feature](admin.feature) | Block-Liste, User-Filter, Statistik-Aggregat |
| [account.feature](account.feature) | Datenexport und Account-Löschung (DSGVO) |
| [security.feature](security.feature) | Security-Filter (Block-Liste, Adult, Safe Browsing, Rate-Limit) |

## Schreibweise

```gherkin
Feature: Kurztitel
  Als <Persona>
  möchte ich <Ziel>,
  damit <Nutzen>.

  Background:
    # Was vor jedem Szenario gilt
    Given …

  Scenario: Beschreibung des Erfolgsfalls
    Given …
    When …
    Then …

  Scenario Outline: Beschreibung mit Beispieltabelle
    Given …
    When ich „<eingabe>" eingebe
    Then sehe ich „<antwort>"

    Examples:
      | eingabe | antwort |
      | a       | x       |
```

## Status

Diese Specs sind **noch nicht automatisiert**. Sie dienen als Vorlage
für Feature E (Backlog) und als Referenz für manuelle QA.
