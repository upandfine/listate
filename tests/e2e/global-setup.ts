/**
 * Playwright global-setup: Test-DB-Inhalte vor dem Run leeren.
 *
 * WICHTIG: Wir loeschen die DB-DATEI NICHT, weil der Dev-Server seine
 * Connection schon beim webServer.url-Health-Check geoeffnet hat
 * (Reihenfolge in Playwright: webServer-Start vor globalSetup). Eine
 * Datei-Loeschung wuerde den Server in einen Phantom-Handle-Zustand
 * versetzen, in dem geschriebene User unsichtbar fuer neue Connections
 * werden → FOREIGN KEY-Violations bei nachgelagerten Inserts.
 *
 * Stattdessen leeren wir die App-Tabellen via SQL (DELETE). Dieselbe
 * Connection (Singleton im Dev-Server) sieht die Deletes sofort.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.resolve(process.cwd(), 'data', 'e2e-test.db');

const TABLES_TO_RESET = [
  'session',
  'account',
  'verificationToken',
  'clicks',
  'links',
  'templates',
  'blocked_hosts',
  'user',
];

export default async function globalSetup() {
  // Wenn die DB-Datei noch nicht existiert, lassen wir sie vom App-
  // Bootstrap im ersten Test-Aufruf anlegen. Sonst: alle App-Tabellen
  // leeren in einer Reihenfolge, die FK-Constraints respektiert
  // (abhaengige Tabellen zuerst).
  if (fs.existsSync(TEST_DB)) {
    const db = new Database(TEST_DB);
    db.pragma('foreign_keys = ON');
    for (const t of TABLES_TO_RESET) {
      try {
        db.exec(`DELETE FROM "${t}"`);
      } catch (err) {
        // Tabelle existiert (noch) nicht — ignorieren.
        if (
          !(err instanceof Error && err.message.includes('no such table'))
        ) {
          throw err;
        }
      }
    }
    db.close();
    console.log(`[e2e-setup] cleared tables in ${TEST_DB}`);
  } else {
    console.log(`[e2e-setup] ${TEST_DB} doesn't exist yet — App-Bootstrap wird sie anlegen`);
  }

  // og-images-Verzeichnis ist Filesystem, gefahrlos zu loeschen.
  const imgDir = path.resolve(process.cwd(), 'data', 'og-images');
  if (fs.existsSync(imgDir)) {
    fs.rmSync(imgDir, { recursive: true, force: true });
    console.log(`[e2e-setup] removed ${imgDir}`);
  }
}
