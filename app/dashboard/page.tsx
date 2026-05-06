import { desc, eq, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { deleteLink } from '@/app/actions';
import { ConfirmButton } from '@/app/components/ConfirmButton';
import { getDb } from '@/db';
import { links, users } from '@/db/schema';
import { getBaseUrl } from '@/lib/baseUrl';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const isAdmin = session.user.role === 'admin';
  const { user: userFilter } = await searchParams;
  const db = getDb();

  const where = isAdmin
    ? userFilter
      ? eq(links.userId, userFilter)
      : sql`1 = 1`
    : eq(links.userId, session.user.id);

  const rows = db
    .select({
      id: links.id,
      originalUrl: links.originalUrl,
      ogTitle: links.ogTitle,
      ogImage: links.ogImage,
      clickCount: links.clickCount,
      createdAt: links.createdAt,
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
          </p>
        </div>

        {isAdmin && (
          <form
            action="/dashboard"
            method="get"
            className="flex items-end gap-2"
          >
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
            <button
              type="submit"
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
            >
              Anwenden
            </button>
          </form>
        )}
      </header>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
          Noch keine Links. Lege auf der Startseite einen an.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((link) => {
            const trackingUrl = `${baseUrl}/t/${link.id}`;
            return (
              <li
                key={link.id}
                className="flex gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
              >
                {link.ogImage && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={link.ogImage}
                    alt=""
                    className="h-20 w-32 flex-shrink-0 rounded-md object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-medium">
                    {link.ogTitle ?? link.originalUrl}
                  </div>
                  <div className="truncate text-xs text-neutral-500">
                    <a
                      href={link.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {link.originalUrl}
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-neutral-700 hover:underline"
                    >
                      {trackingUrl}
                    </a>
                    <span className="text-neutral-400">·</span>
                    <span className="text-neutral-500">
                      {new Date(link.createdAt + 'Z').toLocaleString('de-DE')}
                    </span>
                    {isAdmin && (
                      <>
                        <span className="text-neutral-400">·</span>
                        <span className="text-neutral-500">
                          von {link.ownerEmail ?? link.userId}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end justify-center gap-1.5">
                  <div className="text-right">
                    <div className="text-2xl font-semibold leading-none tabular-nums">
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
