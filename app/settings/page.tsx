import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { count, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { deleteAccountFormAction } from '@/app/actions';
import { ConfirmButton } from '@/app/components/ConfirmButton';
import { getDb } from '@/db';
import { links } from '@/db/schema';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Einstellungen',
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/settings');
  }

  const db = getDb();
  const linkCount =
    db
      .select({ n: count() })
      .from(links)
      .where(eq(links.userId, session.user.id))
      .get()?.n ?? 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Konto- und Datenoptionen.
        </p>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Profil</h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-[max-content,1fr] sm:gap-x-6">
          <dt className="text-neutral-500">E-Mail</dt>
          <dd className="text-neutral-900">{session.user.email}</dd>
          <dt className="text-neutral-500">Rolle</dt>
          <dd className="text-neutral-900">
            {session.user.role === 'admin' ? 'Admin' : 'Nutzer'}
          </dd>
          <dt className="text-neutral-500">Eigene Links</dt>
          <dd className="text-neutral-900">{linkCount}</dd>
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Datenexport</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Lade alle deine Daten als JSON herunter (DSGVO Art.&nbsp;20).
          Enthält Profil, alle deine Links inkl. Klick-Verlauf.
        </p>
        <a
          href="/api/export"
          download
          className="mt-3 inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <DownloadIcon />
          Daten herunterladen (JSON)
        </a>
      </section>

      <section className="rounded-lg border border-accent/30 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-accent">Konto löschen</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Entfernt deinen Account, alle deine {linkCount}{' '}
          Tracking-Link{linkCount === 1 ? '' : 's'} und den kompletten
          Klick-Verlauf. Diese Aktion ist endgültig.
        </p>
        <div className="mt-3">
          <ConfirmButton
            formAction={deleteAccountFormAction}
            buttonLabel="Konto löschen"
            buttonClassName="rounded-md border border-accent/40 bg-white px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-white"
            title="Konto wirklich endgültig löschen?"
            message={
              <>
                Damit verschwinden dein Profil, alle deine Tracking-Links
                <strong> ({linkCount})</strong> und der gesamte Klick-Verlauf.
                Du wirst danach abgemeldet. Die Aktion ist unwiderruflich.
              </>
            }
            confirmLabel="Endgültig löschen"
            danger
          />
        </div>
      </section>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 2 V11" />
      <path d="M4 7 L8 11 L12 7" />
      <path d="M3 13 H13" />
    </svg>
  );
}
