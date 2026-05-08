# language: de
Feature: Vorlagen
  Als Admin
  pflege ich häufig genutzte Ziel-URLs zentral, damit alle Nutzer sie
  in einem Klick zu eigenen Tracking-Links machen können.

  Als angemeldeter Nutzer
  klicke ich eine Vorlage an und erhalte einen persönlichen Tracking-Link
  in meinem Dashboard.

  Background:
    Given die App ist live

  Scenario: Admin legt eine statische Vorlage an
    Given ich bin als Admin angemeldet
    And ich rufe "/admin/templates" auf
    When ich die Felder Bezeichnung "Tagesvers", URL "https://www.lebenistmehr.de/leben-ist-mehr.html" ausfülle
    And auf "Vorlage anlegen" klicke
    Then erscheint die Vorlage in der Liste

  Scenario: Vorlage mit Resolver
    Given ich bin als Admin angemeldet
    When ich eine Vorlage mit Quell-URL "https://www.bibelliga.org/vers-des-tages/" anlege
    And als Pattern "^https://www\.bibelliga\.org/vers-des-tages-[^/]+/$" angebe
    Then taucht in der Liste das Badge "Resolver" auf
    And das Pattern wird unter der URL angezeigt

  Scenario: Resolver-Test im Admin-UI
    Given ich tippe Quell-URL und Pattern in das Add-Form
    When ich auf "Auflösen testen" klicke
    Then erscheint bei Erfolg eine grüne Box "→ Treffer: <ermittelte URL>"
    And bei Misserfolg eine bernsteinfarbene Box mit den ersten 10 Kandidaten

  Scenario: Nutzer erzeugt einen Link aus statischer Vorlage
    Given ich bin als regulärer Nutzer angemeldet
    And eine Vorlage "Tagesvers" mit URL "https://www.lebenistmehr.de/leben-ist-mehr.html" existiert
    When ich "/templates" aufrufe
    And bei "Tagesvers" auf "Link erzeugen" klicke
    Then werde ich auf "/templates?created=<id>" weitergeleitet
    And sehe oben eine Erfolgs-Card mit Tracking-URL und OG-Vorschau
    And der Link erscheint in meinem Dashboard

  Scenario: Nutzer erzeugt einen Link aus Resolver-Vorlage
    Given eine Vorlage "Tagesvers Bibelliga" mit Pattern existiert
    When ich auf "Link erzeugen" für diese Vorlage klicke
    Then wird die Quellseite einmalig serverseitig geladen
    And der erste matchende href wird als Ziel-URL für meinen Tracking-Link verwendet
    And die OG-Daten werden für genau diese aufgelöste URL geholt
    And das Vorlagen-Listenelement zeigt das Badge "Tagesaktuell"

  Scenario: Resolver findet keinen Treffer
    Given eine Vorlage mit unpassendem Pattern existiert
    When ich auf "Link erzeugen" klicke
    Then erscheint eine Fehlermeldung "Kein Link auf der Quellseite passt zum Pattern."
    And kein Tracking-Link wird angelegt

  Scenario: Vorlage löschen lässt bestehende Tracking-Links unberührt
    Given ich habe einen Link aus einer Vorlage erzeugt
    When der Admin die Vorlage löscht
    Then bleibt mein Tracking-Link mit allen Klicks bestehen

  Scenario: Reguläre Nutzer können /admin/templates nicht aufrufen
    Given ich bin als regulärer Nutzer angemeldet
    When ich "/admin/templates" aufrufe
    Then werde ich auf "/" weitergeleitet
