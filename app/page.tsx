import Link from 'next/link';
import { auth } from '@/auth';
import { BrandTile } from './components/BrandMark';
import CreateLinkForm from './components/CreateLinkForm';
import {
  FeatureCountIcon,
  FeaturePreviewIcon,
  FeaturePrivacyIcon,
  StepPasteUrl,
  StepShareInChat,
  StepShortLink,
} from './components/Illustrations';

export default async function HomePage() {
  const session = await auth();
  if (session?.user) {
    return <CreateLinkForm />;
  }
  return <LandingPage />;
}

function LandingPage() {
  return (
    <div className="space-y-24 pb-12">
      {/* Hero */}
      <section className="space-y-6 pt-4 text-center sm:pt-12">
        <div className="mx-auto">
          <BrandTile className="mx-auto h-20 w-20" />
        </div>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight text-brand sm:text-5xl">
          Tracking-Links mit echter Vorschau in WhatsApp, Slack &amp; Co.
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-lg text-neutral-600">
          URL einfügen – kurzer Listate-Link entsteht. Empfänger sehen die
          Original-Vorschau wie immer, du bekommst die Klickzahlen.
        </p>
        <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
          >
            Mit Google anmelden &amp; loslegen
          </Link>
          <a
            href="#funktion"
            className="text-sm text-neutral-600 hover:text-neutral-900"
          >
            Wie funktioniert's? ↓
          </a>
        </div>
      </section>

      {/* Was leistet das Tool */}
      <section className="space-y-8">
        <header className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-brand sm:text-3xl">
            Was Listate leistet
          </h2>
          <p className="mx-auto max-w-xl text-neutral-600">
            Drei einfache Versprechen, die andere Shortener nicht einlösen.
          </p>
        </header>

        <div className="grid gap-6 sm:grid-cols-3">
          <FeatureCard
            icon={<FeaturePreviewIcon />}
            title="Vorschau bleibt erhalten"
            text="Beim Teilen erscheint die echte Open-Graph-Karte der Originalseite – Bild, Titel, Beschreibung. Kein hässlicher Kurz-Link ohne Kontext."
          />
          <FeatureCard
            icon={<FeatureCountIcon />}
            title="Klicks zählen ohne Aufwand"
            text="Jeder Aufruf wird gezählt – Bots und Crawler werden automatisch herausgefiltert. Im Dashboard siehst du, was wirklich gelesen wird."
          />
          <FeatureCard
            icon={<FeaturePrivacyIcon />}
            title="Privacy-freundlich"
            text="Keine Cookies, kein Fingerprinting, keine IP-Speicherung in der App. Nur ein aggregierter Klick-Zähler pro Link."
          />
        </div>
      </section>

      {/* Für wen */}
      <section className="rounded-xl border border-neutral-200 bg-white p-8 sm:p-10">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold text-brand sm:text-3xl">
            Für wen ist Listate gemacht?
          </h2>
          <p className="text-neutral-600">
            Wer Inhalte verschickt und wissen will, ob sie ankommen.
          </p>
        </header>
        <ul className="mt-6 grid gap-3 text-neutral-700 sm:grid-cols-2">
          <Bullet>
            Newsletter-Autor:innen und Blogger:innen, die ihre Verteilung
            messen wollen, ohne UTM-Parameter sichtbar zu kleben.
          </Bullet>
          <Bullet>
            Speaker, Trainer und Coaches, die im Workshop oder
            Vortrag Material teilen und wissen wollen, was tatsächlich
            geklickt wird.
          </Bullet>
          <Bullet>
            Marketing- und Sales-Teams, die Reichweite einzelner Posts in
            Slack, WhatsApp oder LinkedIn nachvollziehen möchten.
          </Bullet>
          <Bullet>
            Alle, die schöne Vorschau-Karten beim Teilen wollen – ohne dass
            der Tracking-Service Inhalte überschreibt.
          </Bullet>
        </ul>
      </section>

      {/* So funktioniert's */}
      <section id="funktion" className="space-y-10 scroll-mt-12">
        <header className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-brand sm:text-3xl">
            So funktioniert's
          </h2>
          <p className="mx-auto max-w-xl text-neutral-600">
            Drei Schritte – mehr ist es nicht.
          </p>
        </header>

        <div className="grid gap-8 sm:grid-cols-3">
          <Step number={1} title="Original-URL einfügen">
            <StepPasteUrl />
            <p className="text-sm text-neutral-600">
              Beliebige Webseite, Blog-Post, PDF, YouTube-Link – alles, was
              eine Adresse hat.
            </p>
          </Step>
          <Step number={2} title="Listate-Link erhalten">
            <StepShortLink />
            <p className="text-sm text-neutral-600">
              In unter einer Sekunde liegt der kurze Tracking-Link in deiner
              Zwischenablage.
            </p>
          </Step>
          <Step number={3} title="Im Chat oder Post teilen">
            <StepShareInChat />
            <p className="text-sm text-neutral-600">
              Empfänger sehen die Original-Vorschau, klicken, landen am Ziel –
              du siehst den Klick im Dashboard.
            </p>
          </Step>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="rounded-xl bg-brand p-10 text-center text-white sm:p-14">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          Bereit, deine Links sichtbar zu machen?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/80">
          Anmeldung mit Google in zehn Sekunden. Keine Kreditkarte, kein
          Newsletter-Zwang.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-brand shadow-sm transition hover:bg-neutral-100"
        >
          Mit Google anmelden
        </Link>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div>{icon}</div>
      <h3 className="text-lg font-semibold text-brand">{title}</h3>
      <p className="text-sm leading-relaxed text-neutral-600">{text}</p>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <svg
        viewBox="0 0 16 16"
        width="20"
        height="20"
        aria-hidden="true"
        className="mt-0.5 flex-shrink-0 text-accent"
      >
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M5 8 L7 10 L11 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
          {number}
        </span>
        <h3 className="text-base font-semibold text-brand">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
