import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { createTemplate, deleteTemplate } from '@/app/actions';
import { ConfirmButton } from '@/app/components/ConfirmButton';
import { getDb } from '@/db';
import { templates, users } from '@/db/schema';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vorlagen verwalten',
};

export default async function AdminTemplatesPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/');

  const rows = getDb()
    .select({
      id: templates.id,
      label: templates.label,
      originalUrl: templates.originalUrl,
      description: templates.description,
      createdAt: templates.createdAt,
      createdByEmail: users.email,
    })
    .from(templates)
    .leftJoin(users, eq(users.id, templates.createdBy))
    .orderBy(desc(templates.createdAt))
    .all();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Vorlagen verwalten</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Häufig genutzte Ziel-URLs zentral pflegen. User wählen sie auf
          der Seite <code className="rounded bg-neutral-100 px-1">/templates</code> per
          Klick aus und bekommen einen persönlichen Tracking-Link darauf.
        </p>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">Neue Vorlage</h2>
        <form action={createTemplate} className="mt-4 space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="label"
              className="block text-sm font-medium text-neutral-700"
            >
              Bezeichnung
            </label>
            <input
              id="label"
              name="label"
              type="text"
              required
              placeholder="Leben ist mehr – Tagesvers"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="url"
              className="block text-sm font-medium text-neutral-700"
            >
              Ziel-URL
            </label>
            <input
              id="url"
              name="url"
              type="url"
              required
              placeholder="https://www.lebenistmehr.de/leben-ist-mehr.html"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <p className="text-xs text-neutral-500">
              Statisch. Wenn die Zielseite selbst „heute" auflöst, übernimmt
              das die Zielseite – Listate setzt keine Datums-Parameter.
            </p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-neutral-700"
            >
              Beschreibung (optional)
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Was ist das, wann sinnvoll zu teilen?"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div>
            <button
              type="submit"
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
            >
              Vorlage anlegen
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          Bestehende Vorlagen ({rows.length})
        </h2>

        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
            Noch keine Vorlagen angelegt.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-medium text-neutral-900">
                    {row.label}
                  </div>
                  {row.description && (
                    <div className="text-sm text-neutral-600">
                      {row.description}
                    </div>
                  )}
                  <a
                    href={row.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all font-mono text-xs text-neutral-500 hover:underline"
                  >
                    {row.originalUrl}
                  </a>
                  <div className="text-xs text-neutral-500">
                    seit{' '}
                    {new Date(row.createdAt + 'Z').toLocaleString('de-DE')}
                    {row.createdByEmail && <> · von {row.createdByEmail}</>}
                  </div>
                </div>

                <ConfirmButton
                  formAction={deleteTemplate}
                  hiddenFields={{ id: row.id }}
                  buttonLabel="Löschen"
                  buttonClassName="self-start rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 sm:self-auto"
                  title="Vorlage löschen?"
                  message={
                    <>
                      <strong>{row.label}</strong> wird aus der Liste
                      entfernt. Bereits erstellte Tracking-Links der User
                      bleiben unberührt.
                    </>
                  }
                  confirmLabel="Endgültig löschen"
                  danger
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
