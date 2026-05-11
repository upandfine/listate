import Link from 'next/link';
import {
  and,
  asc,
  count,
  desc,
  eq,
  isNull,
  like,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { auth } from '@/auth';
import { deleteLink } from '@/app/actions';
import { ConfirmButton } from '@/app/components/ConfirmButton';
import { CopyButton } from '@/app/components/CopyButton';
import { EditLinkButton } from '@/app/components/EditLinkButton';
import { QrButton } from '@/app/components/QrButton';
import { ShareButton } from '@/app/components/ShareButton';
import { Sparkline } from '@/app/components/Sparkline';
import { getDb } from '@/db';
import { links, users } from '@/db/schema';
import { getBaseUrl } from '@/lib/baseUrl';
import { paginate, parsePageParam } from '@/lib/pagination';
import { getClickHistory } from '@/lib/sparkline';
import { parseTags } from '@/lib/tags';
import { isExpired } from '@/lib/ttl';

const PAGE_SIZE = 25;
const SORT_OPTIONS = ['newest', 'clicks', 'alpha'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Neueste zuerst',
  clicks: 'Meiste Klicks',
  alpha: 'Alphabetisch',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    user?: string;
    expired?: string;
    q?: string;
    tag?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const isAdmin = session.user.role === 'admin';
  const sp = await searchParams;
  const userFilter = sp.user;
  const showExpired = sp.expired === '1';
  const search = (sp.q ?? '').trim();
  const tagFilter = (sp.tag ?? '').trim().toLowerCase();
  const sort: SortOption = (SORT_OPTIONS as readonly string[]).includes(
    sp.sort ?? ''
  )
    ? (sp.sort as SortOption)
    : 'newest';
  const requestedPage = parsePageParam(sp.page);
  const db = getDb();

  const conditions: SQL<unknown>[] = [];

  if (isAdmin) {
    if (userFilter) conditions.push(eq(links.userId, userFilter));
  } else {
    conditions.push(eq(links.userId, session.user.id));
  }

  if (!showExpired) {
    // Default: nur aktive Links.
    const active = or(
      isNull(links.expiresAt),
      sql`${links.expiresAt} > datetime('now')`
    );
    if (active) conditions.push(active);
  }

  if (search) {
    const needle = `%${search.toLowerCase()}%`;
    const searchCondition = or(
      like(sql`LOWER(${links.originalUrl})`, needle),
      like(sql`LOWER(COALESCE(${links.ogTitle}, ''))`, needle),
      like(sql`LOWER(COALESCE(${links.slug}, ''))`, needle)
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  if (tagFilter) {
    // Match auf "tag" als ganzes Wort – Komma-Separator umrahmen, damit
    // "newslett" nicht "newsletter" matcht.
    const padded = `%,${tagFilter},%`;
    conditions.push(
      like(sql`',' || COALESCE(${links.tags}, '') || ','`, padded)
    );
  }

  const where =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

  // Total-Count für Pagination
  const totalRow = db
    .select({ n: count() })
    .from(links)
    .where(where ?? sql`1 = 1`)
    .get();
  const total = totalRow?.n ?? 0;
  const { page, totalPages, offset } = paginate(total, requestedPage, PAGE_SIZE);

  const orderBy = (() => {
    switch (sort) {
      case 'clicks':
        return [desc(links.clickCount), desc(links.createdAt)];
      case 'alpha':
        return [asc(sql`COALESCE(LOWER(${links.ogTitle}), LOWER(${links.originalUrl}))`)];
      case 'newest':
      default:
        return [desc(links.createdAt)];
    }
  })();

  const rows = db
    .select({
      id: links.id,
      slug: links.slug,
      originalUrl: links.originalUrl,
      ogTitle: links.ogTitle,
      ogImage: links.ogImage,
      clickCount: links.clickCount,
      createdAt: links.createdAt,
      expiresAt: links.expiresAt,
      tags: links.tags,
      userId: links.userId,
      ownerEmail: users.email,
      ownerName: users.name,
    })
    .from(links)
    .leftJoin(users, eq(users.id, links.userId))
    .where(where)
    .orderBy(...orderBy)
    .limit(PAGE_SIZE)
    .offset(offset)
    .all();

  // Klick-Verlauf der letzten 14 Tage je Link, in einer Query.
  const sparklines = getClickHistory(
    db,
    rows.map((r) => r.id),
    14
  );

  // Tag-Vorschau: alle Tags der angezeigten Links (für die Filter-Pills).
  const allTags = new Set<string>();
  for (const r of rows) {
    for (const t of parseTags(r.tags)) allTags.add(t);
  }
  const tagOptions = Array.from(allTags).sort();

  const userOptions = isAdmin
    ? db
        .select({ id: users.id, email: users.email })
        .from(users)
        .orderBy(users.email)
        .all()
    : [];

  const baseUrl = await getBaseUrl();

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
            {search && ` · Suche: "${search}"`}
            {tagFilter && ` · Tag: "${tagFilter}"`}
          </p>
        </div>

        <form
          action="/dashboard"
          method="get"
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <label
              htmlFor="q"
              className="block text-xs font-medium text-neutral-600"
            >
              Suche
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={search}
              placeholder="URL, Titel, Slug …"
              className="mt-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

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

          <div>
            <label
              htmlFor="sort"
              className="block text-xs font-medium text-neutral-600"
            >
              Sortierung
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={sort}
              className="mt-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

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

          {/* tag-Filter wird ueber die Tag-Pills gesetzt; hier mitsenden, falls aktiv */}
          {tagFilter && <input type="hidden" name="tag" value={tagFilter} />}

          <button
            type="submit"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
          >
            Anwenden
          </button>
        </form>
      </header>

      {/* Tag-Filter-Pills */}
      {tagOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-500">Tags:</span>
          {tagFilter && (
            <Link
              href={buildUrl({ q: search, expired: showExpired, user: userFilter, sort })}
              className="rounded-full bg-neutral-200 px-2.5 py-0.5 font-medium text-neutral-700 hover:bg-neutral-300"
            >
              × {tagFilter}
            </Link>
          )}
          {tagOptions
            .filter((t) => t !== tagFilter)
            .map((t) => (
              <Link
                key={t}
                href={buildUrl({
                  q: search,
                  expired: showExpired,
                  user: userFilter,
                  tag: t,
                  sort,
                })}
                className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-neutral-700 hover:border-brand hover:text-brand"
              >
                {t}
              </Link>
            ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
          {search || tagFilter
            ? 'Keine Links passen zu den Filtern.'
            : 'Noch keine Links. Lege auf der Startseite einen an.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((link) => {
            const trackingPath = link.slug ?? link.id;
            const trackingUrl = `${baseUrl}/t/${trackingPath}`;
            const expired = isExpired(link.expiresAt);
            const linkTags = parseTags(link.tags);
            const series = sparklines.get(link.id) ?? [];
            return (
              <li
                key={link.id}
                className={
                  'rounded-lg border bg-white shadow-sm ' +
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
                      className="h-32 w-full flex-shrink-0 rounded-t-lg object-cover sm:h-auto sm:w-32 sm:rounded-l-lg sm:rounded-tr-none"
                    />
                  )}

                  <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
                    {/* Headline + Original-URL */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-neutral-900">
                          {link.ogTitle ?? link.originalUrl}
                        </span>
                        {link.slug && (
                          <span
                            title="Eigener Slug"
                            className="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand"
                          >
                            /{link.slug}
                          </span>
                        )}
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

                    {/* Tracking-URL + Copy + Share + QR */}
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
                      <ShareButton value={trackingUrl} />
                      <QrButton value={trackingUrl} />
                    </div>

                    {/* Tags */}
                    {linkTags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {linkTags.map((t) => (
                          <Link
                            key={t}
                            href={buildUrl({
                              q: search,
                              expired: showExpired,
                              user: userFilter,
                              tag: t,
                            })}
                            className={
                              'rounded-full px-2 py-0.5 font-medium ' +
                              (t === tagFilter
                                ? 'bg-brand text-white'
                                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200')
                            }
                          >
                            #{t}
                          </Link>
                        ))}
                      </div>
                    )}

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

                  {/* Klicks (mit Sparkline) + Aktionen */}
                  <div className="flex items-center justify-between gap-3 rounded-b-lg border-t border-neutral-200 bg-neutral-50 px-4 py-3 sm:flex-col sm:justify-center sm:rounded-b-none sm:rounded-r-lg sm:border-l sm:border-t-0 sm:bg-transparent sm:px-5 sm:py-4">
                    <Link
                      href={`/links/${link.id}`}
                      className="text-left transition hover:opacity-80 sm:text-right"
                      title="Statistik öffnen"
                    >
                      <div className="text-2xl font-semibold leading-none tabular-nums text-neutral-900">
                        {link.clickCount}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
                        Klicks
                      </div>
                      {series.length > 0 && (
                        <div className="mt-1.5 flex justify-start sm:justify-end">
                          <Sparkline data={series} />
                        </div>
                      )}
                    </Link>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                      <EditLinkButton
                        linkId={link.id}
                        defaultUrl={link.originalUrl}
                        defaultSlug={link.slug ?? null}
                        defaultTags={(linkTags ?? []).join(', ')}
                        hasExpiry={!!link.expiresAt}
                      />
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
                            Damit verschwinden Tracking-URL, Klick-Zähler
                            und Klick-Verlauf unwiderruflich. Die
                            ursprüngliche Original-URL bleibt natürlich
                            existieren.
                          </>
                        }
                        confirmLabel="Endgültig löschen"
                        danger
                      />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-3 pt-2 text-sm">
          <div className="text-xs text-neutral-500">
            Seite {page} von {totalPages} · {total} Link
            {total === 1 ? '' : 's'} insgesamt
          </div>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildUrl({
                  q: search,
                  expired: showExpired,
                  user: userFilter,
                  tag: tagFilter || undefined,
                  sort,
                  page: page - 1,
                })}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
              >
                ← Vorherige
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildUrl({
                  q: search,
                  expired: showExpired,
                  user: userFilter,
                  tag: tagFilter || undefined,
                  sort,
                  page: page + 1,
                })}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
              >
                Nächste →
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

function buildUrl(params: {
  q?: string;
  expired?: boolean;
  user?: string;
  tag?: string;
  sort?: SortOption;
  page?: number;
}): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.expired) sp.set('expired', '1');
  if (params.user) sp.set('user', params.user);
  if (params.tag) sp.set('tag', params.tag);
  if (params.sort && params.sort !== 'newest') sp.set('sort', params.sort);
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  const qs = sp.toString();
  return qs ? `/dashboard?${qs}` : '/dashboard';
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
