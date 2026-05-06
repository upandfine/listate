import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { blockHost, unblockHost } from '@/app/actions';
import { ConfirmButton } from '@/app/components/ConfirmButton';
import { getDb } from '@/db';
import { blockedHosts, users } from '@/db/schema';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Blockliste',
};

export default async function BlockedHostsPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/');

  const rows = getDb()
    .select({
      host: blockedHosts.host,
      reason: blockedHosts.reason,
      createdAt: blockedHosts.createdAt,
      createdByEmail: users.email,
    })
    .from(blockedHosts)
    .leftJoin(users, eq(users.id, blockedHosts.createdBy))
    .orderBy(desc(blockedHosts.createdAt))
    .all();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Blockliste</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Hostnamen, für die keine neuen Tracking-Links erstellt werden
          können. Subdomain &quot;www.&quot; wird ignoriert; Pfade werden
          nicht unterschieden.
        </p>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Host hinzufügen</h2>
        <form action={blockHost} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="host"
                className="block text-sm font-medium text-neutral-700"
              >
                Hostname oder URL
              </label>
              <input
                id="host"
                name="host"
                type="text"
                required
                placeholder="example.com"
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              <p className="text-xs text-neutral-500">
                Eingabe wird auf den reinen Host normalisiert.
              </p>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="reason"
                className="block text-sm font-medium text-neutral-700"
              >
                Grund (optional)
              </label>
              <input
                id="reason"
                name="reason"
                type="text"
                placeholder="z.&nbsp;B. Spam, Phishing, auf Wunsch"
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              <p className="text-xs text-neutral-500">
                Erscheint Nutzern in der Fehlermeldung beim Erstellen.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="alsoDelete"
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
            />
            <span>
              Bestehende Links zu diesem Host gleich mitlöschen.
              <span className="ml-1 text-xs text-neutral-500">
                (Klick-Zähler gehen verloren.)
              </span>
            </span>
          </label>

          <div>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
            >
              Host blockieren
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          Aktuell blockiert ({rows.length})
        </h2>

        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
            Aktuell sind keine Hosts blockiert.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.host}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="font-mono text-sm text-neutral-900">
                    {row.host}
                  </div>
                  {row.reason && (
                    <div className="text-xs text-neutral-600">
                      {row.reason}
                    </div>
                  )}
                  <div className="text-xs text-neutral-500">
                    seit{' '}
                    {new Date(row.createdAt + 'Z').toLocaleString('de-DE')}
                    {row.createdByEmail && <> · von {row.createdByEmail}</>}
                  </div>
                </div>
                <ConfirmButton
                  formAction={unblockHost}
                  hiddenFields={{ host: row.host }}
                  buttonLabel="Aufheben"
                  buttonClassName="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  title="Host wieder freigeben?"
                  message={
                    <>
                      <code className="rounded bg-neutral-100 px-1">
                        {row.host}
                      </code>{' '}
                      darf danach wieder Tracking-Links bekommen. Bestehende
                      Links bleiben unberührt.
                    </>
                  }
                  confirmLabel="Sperrung aufheben"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
