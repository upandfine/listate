import db, { type LinkRow } from '@/lib/db';
import { getBaseUrl } from '@/lib/baseUrl';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const links = db
    .prepare('SELECT * FROM links ORDER BY created_at DESC')
    .all() as LinkRow[];

  const baseUrl = getBaseUrl();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {links.length} Link{links.length === 1 ? '' : 's'} insgesamt
        </p>
      </header>

      {links.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-600">
          Noch keine Links. Lege auf der Startseite einen an.
        </div>
      ) : (
        <ul className="space-y-3">
          {links.map((link) => {
            const trackingUrl = `${baseUrl}/t/${link.id}`;
            return (
              <li
                key={link.id}
                className="flex gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
              >
                {link.og_image && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={link.og_image}
                    alt=""
                    className="h-20 w-32 flex-shrink-0 rounded-md object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-medium">
                    {link.og_title ?? link.original_url}
                  </div>
                  <div className="truncate text-xs text-neutral-500">
                    <a
                      href={link.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {link.original_url}
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
                      {new Date(link.created_at + 'Z').toLocaleString('de-DE')}
                    </span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end justify-center">
                  <div className="text-2xl font-semibold tabular-nums">
                    {link.click_count}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">
                    Klicks
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
