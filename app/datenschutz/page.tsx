import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutz – Listate',
  description: 'Datenschutzerklärung des Tracking-Link-Dienstes',
};

export default function DatenschutzPage() {
  const stand = new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <article className="space-y-6 text-neutral-800 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_a]:text-neutral-900 [&_a]:underline [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Datenschutzerklärung</h1>
        <p className="text-sm text-neutral-500">Stand: {stand}</p>
      </header>

      <section>
        <h2>1. Verantwortlicher</h2>
        <p>
          Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO)
          und anderer nationaler Datenschutzgesetze sowie sonstiger
          datenschutzrechtlicher Bestimmungen ist:
        </p>
        <p>
          UP&amp;FINE UG (haftungsbeschränkt)
          <br />
          Am Kleeberg 6a
          <br />
          33178 Borchen
          <br />
          Deutschland
          <br />
          Tel.: 05251 5402431
          <br />
          E-Mail:{' '}
          <a href="mailto:schneider@upandfine.de">schneider@upandfine.de</a>
        </p>
        <p>
          Vertreten durch den Geschäftsführer Samuel Schneider.
        </p>
      </section>

      <section>
        <h2>2. Allgemeine Hinweise</h2>
        <p>
          Diese Datenschutzerklärung informiert Sie darüber, welche
          personenbezogenen Daten beim Besuch und bei der Nutzung dieses
          Dienstes verarbeitet werden. Personenbezogene Daten sind alle
          Daten, mit denen Sie persönlich identifiziert werden können.
        </p>
      </section>

      <section>
        <h2>3. Zweck des Dienstes</h2>
        <p>
          Über diesen Dienst werden Tracking-Links erstellt: Eine
          eingegebene Original-URL erhält einen kurzen Verweis (z.&nbsp;B.{' '}
          <code>/t/abc123</code>), der beim Aufruf die Anzahl der Klicks
          zählt und anschließend auf die Original-URL weiterleitet. Die
          Vorschau-Daten der Originalseite (Open-Graph-Tags) werden
          zwischengespeichert, damit Messenger und soziale Netzwerke beim
          Teilen eine Vorschau anzeigen können.
        </p>
      </section>

      <section>
        <h2>4. Hosting</h2>
        <h3>Sliplane</h3>
        <p>
          Diese Anwendung wird bei der Sliplane Hosting Solutions UG
          (haftungsbeschränkt), Hamburg, gehostet. Beim Aufruf der Seite
          werden vom Hoster automatisch technische Zugriffsdaten
          (insbesondere IP-Adresse, User-Agent, Datum/Uhrzeit, angefragter
          Pfad, Referrer) in Server-Logfiles erfasst und für einen
          begrenzten Zeitraum gespeichert. Diese Verarbeitung erfolgt zur
          Sicherstellung des stabilen und sicheren Betriebs sowie zur
          Abwehr von Angriffen.
        </p>
        <p>
          Rechtsgrundlage ist Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO
          (berechtigtes Interesse am sicheren Betrieb der Anwendung). Mit
          dem Hoster wurde ein Vertrag zur Auftragsverarbeitung gemäß
          Art.&nbsp;28 DSGVO abgeschlossen.
        </p>
        <p>
          Weitere Informationen entnehmen Sie der Datenschutzerklärung von
          Sliplane:{' '}
          <a
            href="https://sliplane.io/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://sliplane.io/privacy
          </a>
          .
        </p>
      </section>

      <section>
        <h2>5. Verarbeitete Daten in dieser Anwendung</h2>

        <h3>5.1 Beim Erstellen eines Tracking-Links</h3>
        <p>Wenn Sie einen Tracking-Link erstellen, werden gespeichert:</p>
        <ul>
          <li>die von Ihnen eingegebene Original-URL,</li>
          <li>
            die öffentlich abrufbaren Vorschau-Daten der Originalseite
            (Open-Graph-Titel, -Beschreibung, -Bild-URL, -Site-Name),
          </li>
          <li>eine zufällig erzeugte Kurz-ID,</li>
          <li>der Erstellungszeitpunkt.</li>
        </ul>
        <p>
          Beim Erstellen wird die Originalseite einmalig serverseitig
          aufgerufen, um die Vorschau-Daten auszulesen. Hierbei wird die
          IP-Adresse des Servers (nicht die des Erstellers) gegenüber der
          Originalseite offengelegt.
        </p>

        <h3>5.2 Beim Aufruf eines Tracking-Links</h3>
        <p>
          Wenn ein Nutzer einen Tracking-Link aufruft, wird in der
          Datenbank ausschließlich ein{' '}
          <strong>aggregierter Klick-Zähler</strong> für diesen Link um
          &nbsp;1 erhöht. Es werden in der Anwendungsdatenbank{' '}
          <strong>keine personenbezogenen Einzeldaten</strong>{' '}
          (insbesondere keine IP-Adressen, keine User-Agent-Strings, keine
          Zeitstempel pro Klick, keine Cookies) gespeichert. Anschließend
          erfolgt eine Weiterleitung auf die Original-URL.
        </p>
        <p>
          Aufrufe durch erkannte Crawler von Messengern und sozialen
          Netzwerken (z.&nbsp;B. WhatsApp, Slack, LinkedIn, Telegram,
          Discord, Twitter/X, Facebook) werden nicht gezählt, um die
          Klickzahlen nicht zu verfälschen.
        </p>
        <p>
          Unabhängig hiervon erhebt der Hoster die unter Ziffer&nbsp;4
          genannten Server-Logfiles.
        </p>
      </section>

      <section>
        <h2>6. Cookies und Tracking-Technologien</h2>
        <p>
          Diese Anwendung setzt keine eigenen Cookies, kein
          Webanalyse-Tool und keine Drittanbieter-Tracking-Skripte ein.
          Beim Aufruf eines Tracking-Links werden ebenfalls keine Cookies
          gesetzt; die Weiterleitung erfolgt unmittelbar.
        </p>
      </section>

      <section>
        <h2>7. Open-Graph-Vorschau-Bilder</h2>
        <p>
          Die Vorschauseite eines Tracking-Links bindet das Vorschau-Bild
          der Originalseite per URL ein. Wird ein Crawler oder Browser auf
          die Vorschau geleitet, kann er das Bild direkt vom Server der
          Originalseite abrufen. Über diesen Vorgang können bei dem
          Anbieter der Originalseite technische Zugriffsdaten anfallen,
          auf die wir keinen Einfluss haben.
        </p>
      </section>

      <section>
        <h2>8. Rechtsgrundlagen der Verarbeitung</h2>
        <ul>
          <li>
            <strong>Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO</strong> –
            berechtigtes Interesse am sicheren, stabilen Betrieb des
            Dienstes und an aggregierten Reichweitenstatistiken.
          </li>
          <li>
            <strong>Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO</strong> –
            soweit die Verarbeitung zur Bereitstellung des Dienstes
            (Erstellung und Auflösung des Tracking-Links) erforderlich
            ist.
          </li>
        </ul>
      </section>

      <section>
        <h2>9. Speicherdauer</h2>
        <ul>
          <li>
            <strong>Server-Logfiles des Hosters:</strong> nach Maßgabe der
            Hoster-Datenschutzerklärung, in der Regel wenige Tage bis
            Wochen.
          </li>
          <li>
            <strong>Tracking-Links und aggregierte Klickzahlen:</strong>{' '}
            bis zur Löschung durch den Verantwortlichen oder bis der Zweck
            entfällt.
          </li>
        </ul>
      </section>

      <section>
        <h2>10. Empfänger der Daten</h2>
        <p>
          Eine Übermittlung personenbezogener Daten an Dritte findet nicht
          statt, mit Ausnahme der technisch erforderlichen Verarbeitung
          durch den Hoster (siehe Ziffer&nbsp;4). Eine Übermittlung in
          Drittstaaten außerhalb der EU/des EWR findet durch diese
          Anwendung nicht aktiv statt.
        </p>
      </section>

      <section>
        <h2>11. Ihre Rechte</h2>
        <p>Sie haben gegenüber dem Verantwortlichen folgende Rechte:</p>
        <ul>
          <li>Auskunft (Art.&nbsp;15 DSGVO),</li>
          <li>Berichtigung (Art.&nbsp;16 DSGVO),</li>
          <li>Löschung (Art.&nbsp;17 DSGVO),</li>
          <li>Einschränkung der Verarbeitung (Art.&nbsp;18 DSGVO),</li>
          <li>Datenübertragbarkeit (Art.&nbsp;20 DSGVO),</li>
          <li>
            Widerspruch gegen die Verarbeitung auf Grundlage berechtigten
            Interesses (Art.&nbsp;21 DSGVO).
          </li>
        </ul>
        <p>
          Zur Ausübung dieser Rechte genügt eine formlose Mitteilung an
          die unter Ziffer&nbsp;1 genannten Kontaktdaten.
        </p>
      </section>

      <section>
        <h2>12. Beschwerderecht bei der Aufsichtsbehörde</h2>
        <p>
          Sie haben das Recht, sich bei einer
          Datenschutz-Aufsichtsbehörde über die Verarbeitung Ihrer
          personenbezogenen Daten zu beschweren. Zuständig ist die
          Aufsichtsbehörde des Bundeslandes, in dem der Verantwortliche
          seinen Sitz hat.
        </p>
      </section>

      <section>
        <h2>13. SSL-/TLS-Verschlüsselung</h2>
        <p>
          Diese Seite nutzt aus Sicherheitsgründen eine SSL- bzw.
          TLS-Verschlüsselung. Sie erkennen eine verschlüsselte
          Verbindung daran, dass die Adresszeile des Browsers von
          „http://&rdquo; auf „https://&rdquo; wechselt.
        </p>
      </section>

      <section>
        <h2>14. Aktualität und Änderung dieser Datenschutzerklärung</h2>
        <p>
          Diese Datenschutzerklärung kann angepasst werden, wenn sich
          rechtliche Rahmenbedingungen oder die Verarbeitungstätigkeiten
          ändern. Es gilt jeweils die auf dieser Seite veröffentlichte,
          aktuelle Fassung.
        </p>
      </section>
    </article>
  );
}
