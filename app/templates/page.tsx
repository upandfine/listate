import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { useTemplate } from '@/app/actions';
import { CopyButton } from '@/app/components/CopyButton';
import { getDb } from '@/db';
import { links, templates } from '@/db/schema';
import { getBaseUrl } from '@/lib/baseUrl';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vorlagen',
};

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/templates');

  const { created } = await searchParams;
  const isAdmin = session.user.role === 'admin';
  const db = getDb();
  const baseUrl = getBaseUrl();

  const rows = db
    .select()
    .from(templates)
    .orderBy(desc(templates.createdAt))
    .all();

  // Just-created Link aus DB nachladen, damit wir Tracking-URL + OG-Preview
  // direkt anzeigen können. Nur Links des aktuellen Users sichtbar machen.
  let justCreated: typeof links.$inferSelect | null = null;
  if (created) {
    justCreated =
      db
        .select()
        .from(links)
        .where(and(eq(links.id, created), eq(links.userId, session.user.id)))
        .get() ?? null;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Vorlagen</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Vorausgewählte Ziel-URLs. Klick auf „Link erzeugen" legt einen
          persönlichen Tracking-Link in deinem{' '}
          <Link href="/dashboard" className="underline hover:no-underline">
            Dashboard
          </Link>{' '}
          an.
        </p>
      </header>

      {justCreated && (
        <section className="space-y-3 rounded-lg border border-accent/30 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-accent">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 8.5 L6.5 12 L13 4.5" />
            </svg>
            Tracking-Link erstellt
          </div>

          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-neutral-100 px-3 py-2 text-sm">
              {`${baseUrl}/t/${justCreated.id}`}
            </code>
            <CopyButton value={`${baseUrl}/t/${justCreated.id}`} />
          </div>

          {(justCreated.ogImage || justCreated.ogTitle) && (
            <div className="overflow-hidden rounded-md border border-neutral-200">
              {justCreated.ogImage && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={justCreated.ogImage}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              )}
              <div className="space-y-1 p-3">
                {justCreated.ogSiteName && (
                  <div className="text-xs uppercase tracking-wide text-neutral-500">
                    {justCreated.ogSiteName}
                  </div>
                )}
                <div className="font-medium text-neutral-900">
                  {justCreated.ogTitle ?? '(kein Titel)'}
                </div>
                {justCreated.ogDescription && (
                  <p className="text-sm text-neutral-600">
                    {justCreated.ogDescription}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {isAdmin && (
        <div className="text-sm">
          <Link
            href="/admin/templates"
            className="text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
          >
            → Vorlagen verwalten
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
          {isAdmin ? (
            <>
              Noch keine Vorlagen.{' '}
              <Link
                href="/admin/templates"
                className="font-medium text-brand underline-offset-2 hover:underline"
              >
                Jetzt anlegen
              </Link>
              .
            </>
          ) : (
            <>
              Aktuell sind keine Vorlagen verfügbar. Frag den Admin, ob
              welche eingerichtet werden können.
            </>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((tpl) => (
            <li
              key={tpl.id}
              className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-medium text-neutral-900">{tpl.label}</div>
                {tpl.description && (
                  <p className="text-sm text-neutral-600">{tpl.description}</p>
                )}
                <a
                  href={tpl.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-all font-mono text-xs text-neutral-500 hover:underline"
                >
                  {tpl.originalUrl}
                </a>
              </div>

              <form action={useTemplate} className="self-start sm:self-center">
                <input type="hidden" name="templateId" value={tpl.id} />
                <button
                  type="submit"
                  className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark"
                >
                  Link erzeugen
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
