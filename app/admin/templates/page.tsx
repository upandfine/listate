import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { deleteTemplate } from '@/app/actions';
import { ConfirmButton } from '@/app/components/ConfirmButton';
import { getDb } from '@/db';
import { templates, users } from '@/db/schema';
import { TemplateForm } from './TemplateForm';

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
      urlPattern: templates.urlPattern,
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
        <TemplateForm />
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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-neutral-900">
                      {row.label}
                    </span>
                    {row.urlPattern && (
                      <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                        Resolver
                      </span>
                    )}
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
                  {row.urlPattern && (
                    <div className="break-all font-mono text-xs text-neutral-500">
                      Pattern: <span className="text-brand">{row.urlPattern}</span>
                    </div>
                  )}
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
