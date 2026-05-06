import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum – LinkTracker',
  description: 'Impressum gemäß § 5 DDG',
};

export default function ImpressumPage() {
  return (
    <article className="space-y-6 text-neutral-800 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_p]:leading-relaxed [&_a]:text-neutral-900 [&_a]:underline">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Impressum</h1>
        <p className="text-sm text-neutral-500">Transparenz als Grundlage.</p>
      </header>

      <section>
        <h2>Angaben gemäß § 5 DDG</h2>
        <p>
          UP&amp;FINE UG (haftungsbeschränkt)
          <br />
          Am Kleeberg 6a
          <br />
          33178 Borchen
        </p>
      </section>

      <section>
        <h2>Vertreten durch</h2>
        <p>Geschäftsführer Samuel Schneider</p>
      </section>

      <section>
        <h2>Kontakt</h2>
        <p>
          Telefon: 05251 5402431
          <br />
          E-Mail:{' '}
          <a href="mailto:schneider@upandfine.de">schneider@upandfine.de</a>
        </p>
      </section>

      <section>
        <h2>Registereintrag</h2>
        <p>
          Eintragung im Handelsregister
          <br />
          Registergericht: Amtsgericht Paderborn
          <br />
          Registernummer: HRB 14634
        </p>
      </section>

      <section>
        <h2>Umsatzsteuer-ID</h2>
        <p>
          Gemäß § 27 a Umsatzsteuergesetz:
          <br />
          DE333106943
        </p>
      </section>

      <section>
        <h2>Redaktionell verantwortlich</h2>
        <p>
          Gemäß § 18 Abs. 2 MStV
          <br />
          Samuel Schneider
          <br />
          Am Kleeberg 6a
          <br />
          33178 Borchen
        </p>
      </section>
    </article>
  );
}
