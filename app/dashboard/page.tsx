import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { deleteLink } from '@/app/actions';
import { ConfirmButton } from '@/app/components/ConfirmButton';
import { CopyButton } from '@/app/components/CopyButton';
import { getDb } from '@/db';
import { links, users } from '@/db/schema';
import { getBaseUrl } from '@/lib/baseUrl';
import { isExpired } from '@/lib/ttl';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; expired?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const isAdmin = session.user.role === 'admin';
  const { user: userFilter, expired } = await searchParams;
  const showExpired = expired === '1';
  const db = getDb();

  const ownerCondition = isAdmin
    ? userFilter
      ? eq(links.userId, userFilter)
      : sql`1 = 1`
    : eq(links.userId, session.user.id);

  // Default: nur aktive Links. Mit ?expired=1 werden auch abgelaufene gezeigt.
  const activeCondition = or(
    isNull(links.expiresAt),
    sql`${links.expiresAt} > datetime('now')`
  );

  const where = showExpired
    ? ownerCondition
    : and(ownerCondition, activeCondition);

  const rows = db
    .select({
      id: links.id,
      originalUrl: links.originalUrl,
      ogTitle: links.ogTitle,
      ogImage: links.ogImage,
      clickCount: links.clickCount,
      createdAt: links.createdAt,
      expiresAt: links.expiresAt,
      userId: links.userId,
      ownerEmail: users.email,
      ownerName: users.name,
    })
    .from(links)
    .leftJoin(users, eq(users.id, links.userId))
    .where(where)
    .orderBy(desc(links.createdAt))
    .all();

  const userOptions = isAdmin
    ? db
        .select({ id: users.id, email: users.email })
        .from(users)
        .orderBy(users.email)
        .all()
    : [];

  const baseUrl = getBaseUrl();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {rows.length} Link{rows.length === 1 ? '' : 's'}
            {isAdmin && (
              <>
                {' '}
                {userFilter ? '(gefiltert)' : '(alle Nutzer)'}
              </>
            )}
            {showExpired && ' · inkl. abgelaufener'}
          </p>
        </div>

        <form
          action="/dashboard"
          method="get"
          className="flex flex-wrap items-end gap-3"
        >
          {isAdmin && (
            <div>
              <label
                htmlFor="user"
                className="block text-xs font-medium text-neutral-600"
              >
                Nutzer-Filter
              </label>
              <select
                id="user"
                name="user"
                defaultValue={userFilter ?? ''}
                className="mt-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm"
              >
                <option value="">Alle Nutzer</option>
                {userOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email ?? u.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 pb-1.5 text-xs text-neutral-700">
            <input
              type="checkbox"
              name="expired"
              value="1"
              defaultChecked={showExpired}
              className="h-4 w-4 rounded border-neutral-300 text-brand focus:ring-brand"
            />
            Abgelaufene anzeigen
          </label>

          <button
            type="submit"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
          >
            Anwenden
          </button>
        </form>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
          Noch keine Links. Lege auf der Startseite einen an.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((link) => {
            const trackingUrl = `${baseUrl}/t/${link.id}`;
            const expired = isExpired(link.expiresAt);
            return (
              <li
                key={link.id}
                className={
                  'overflow-hidden rounded-lg border bg-white shadow-sm ' +
                  (expired
                    ? 'border-neutral-200 opacity-60'
                    : 'border-neutral-200')
                }
              >
                <div className="flex flex-col sm:flex-row">
                  {link.ogImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={link.ogImage}
                      alt=""
                      className="h-32 w-full flex-shrink-0 object-cover sm:h-auto sm:w-32"
                    />
                  )}

                  <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                    {/* Headline + Original-URL */}
                    <div className="min-w-0 space-y-1">
                      <div className="font-medium text-neutral-900">
                        {link.ogTitle ?? link.originalUrl}
                      </div>
                      <a
                        href={link.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-xs text-neutral-500 hover:underline"
                      >
                        {link.originalUrl}
                      </a>
                    </div>

                    {/* Tracking-URL + Copy */}
                    <div className="flex min-w-0 items-center gap-2">
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 truncate rounded bg-neutral-100 px-2 py-1 font-mono text-xs text-neutral-700 hover:underline"
                      >
                        {trackingUrl}
                      </a>
                      <CopyButton value={trackingUrl} />
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                      <span>
                        {new Date(link.createdAt + 'Z').toLocaleString('de-DE')}
                      </span>
                      {link.expiresAt && (
                        <>
                          <span className="text-neutral-300">·</span>
                          {expired ? (
                            <span className="rounded bg-accent/10 px-1.5 py-0.5 font-medium text-accent">
                              abgelaufen am{' '}
                              {new Date(
                                link.expiresAt + 'Z'
                              ).toLocaleDateString('de-DE')}
                            </span>
                          ) : (
                            <span>
                              läuft ab am{' '}
                              {new Date(
                                link.expiresAt + 'Z'
                              ).toLocaleDateString('de-DE')}
                            </span>
                          )}
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <span className="text-neutral-300">·</span>
                          <span>
                            von {link.ownerEmail ?? link.userId}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Klicks + Aktionen */}
                  <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-4 py-3 sm:flex-col sm:justify-center sm:border-l sm:border-t-0 sm:bg-transparent sm:px-5 sm:py-4">
                    <div className="text-left sm:text-right">
                      <div className="text-2xl font-semibold leading-none tabular-nums text-neutral-900">
                        {link.clickCount}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                        Klicks
                      </div>
                    </div>
                    <ConfirmButton
                      formAction={deleteLink}
                      hiddenFields={{ id: link.id }}
                      buttonAriaLabel="Link löschen"
                      buttonClassName="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                      buttonLabel={
                        <span className="flex items-center gap-1">
                          <TrashIcon />
                          Löschen
                        </span>
                      }
                      title="Link wirklich löschen?"
                      message={
                        <>
                          Damit verschwinden Tracking-URL und Klick-Zähler
                          unwiderruflich. Die ursprüngliche Original-URL
                          bleibt natürlich existieren.
                        </>
                      }
                      confirmLabel="Endgültig löschen"
                      danger
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4 H13" />
      <path d="M6 4 V2.5 a1 1 0 0 1 1 -1 h2 a1 1 0 0 1 1 1 V4" />
      <path d="M4.5 4 L5 13 a1 1 0 0 0 1 1 h4 a1 1 0 0 0 1 -1 L11.5 4" />
    </svg>
  );
}
