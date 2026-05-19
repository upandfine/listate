import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { CopyButton } from '@/app/components/CopyButton';
import { Heatmap } from '@/app/components/Heatmap';
import { PreviewOverrideButton } from '@/app/components/PreviewOverrideButton';
import { QrButton } from '@/app/components/QrButton';
import { ShareButton } from '@/app/components/ShareButton';
import { Sparkline } from '@/app/components/Sparkline';
import { getDb } from '@/db';
import { links, users } from '@/db/schema';
import { linkListProjection } from '@/db/types';
import { getBaseUrl } from '@/lib/baseUrl';
import {
  getCountryBreakdown,
  getDailyClicks,
  getHeatmap,
  getRecentClicks,
  type CountryBreakdownEntry,
} from '@/lib/clickStats';
import { getDisplayOg } from '@/lib/displayOg';
import { parseTags } from '@/lib/tags';
import { isExpired } from '@/lib/ttl';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Link-Statistik',
};

export default async function LinkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { id } = await params;
  const db = getDb();

  const row = db
    .select(linkListProjection)
    .from(links)
    .leftJoin(users, eq(users.id, links.userId))
    .where(eq(links.id, id))
    .get();

  if (!row) notFound();

  const isAdmin = session.user.role === 'admin';
  const isOwner = row.userId === session.user.id;
  if (!isAdmin && !isOwner) notFound();

  const baseUrl = await getBaseUrl();
  const trackingPath = row.slug ?? row.id;
  const trackingUrl = `${baseUrl}/t/${trackingPath}`;
  const expired = isExpired(row.expiresAt);
  const linkTags = parseTags(row.tags);

  const daily = getDailyClicks(db, row.id, 30);
  const heatmap = getHeatmap(db, row.id, 90);
  const recent = getRecentClicks(db, row.id, 30);
  const countries = getCountryBreakdown(db, row.id, 90);

  const totalLast30 = daily.reduce((s, d) => s + d.count, 0);
  const last7 = daily.slice(-7).reduce((s, d) => s + d.count, 0);

  // Top-Slot: Wochentag/Stunde mit den meisten Klicks (über 90 Tage).
  let topDow = -1;
  let topHour = -1;
  let topCount = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (heatmap[d][h] > topCount) {
        topCount = heatmap[d][h];
        topDow = d;
        topHour = h;
      }
    }
  }
  const dowLabels = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Link
          href="/dashboard"
          className="text-xs text-neutral-600 hover:text-neutral-900"
        >
          ← zurück zum Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-neutral-900">
          {getDisplayOg(row).title ?? row.originalUrl}
        </h1>
        <p className="break-all text-xs text-neutral-500">
          <a
            href={row.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {row.originalUrl}
          </a>
        </p>
        {linkTags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {linkTags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Tracking-URL + Aktionen */}
      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          Tracking-Link
        </div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded bg-neutral-100 px-3 py-2 text-sm">
            {trackingUrl}
          </code>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={trackingUrl} />
            <ShareButton value={trackingUrl} />
            <QrButton value={trackingUrl} />
            <PreviewOverrideButton
              link={{
                id: row.id,
                ogTitle: row.ogTitle,
                ogDescription: row.ogDescription,
                ogImage: row.ogImage,
                ogSiteName: row.ogSiteName,
                customTitle: row.customTitle,
                customDescription: row.customDescription,
                customSiteName: row.customSiteName,
                customImagePath: row.customImagePath,
                imageHidden: row.imageHidden,
              }}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
          <span>
            erstellt am {new Date(row.createdAt + 'Z').toLocaleString('de-DE')}
          </span>
          {isAdmin && row.ownerEmail && (
            <span>von {row.ownerEmail}</span>
          )}
          {row.expiresAt && (
            <span className={expired ? 'font-medium text-accent' : undefined}>
              {expired ? 'abgelaufen' : 'läuft ab'} am{' '}
              {new Date(row.expiresAt + 'Z').toLocaleDateString('de-DE')}
            </span>
          )}
          {row.slug && (
            <span className="rounded bg-brand/10 px-1.5 py-0.5 font-mono font-medium text-brand">
              /{row.slug}
            </span>
          )}
        </div>
      </section>

      {/* Kennzahlen */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Klicks insgesamt" value={row.clickCount} />
        <Stat label="Letzte 30 Tage" value={totalLast30} />
        <Stat label="Letzte 7 Tage" value={last7} />
      </section>

      {/* 30-Tage-Verlauf */}
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <header>
          <h2 className="text-base font-semibold">30-Tage-Verlauf</h2>
          <p className="text-xs text-neutral-500">
            Klicks pro Tag (UTC). Hover für Werte.
          </p>
        </header>
        {totalLast30 === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
            Noch keine Klicks in den letzten 30 Tagen.
          </div>
        ) : (
          <DailyBarChart data={daily} />
        )}
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>14-Tage-Trend:</span>
          <Sparkline data={daily.slice(-14)} width={140} height={28} />
        </div>
      </section>

      {/* Heatmap */}
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <header>
          <h2 className="text-base font-semibold">Wann wird geklickt?</h2>
          <p className="text-xs text-neutral-500">
            Klicks der letzten 90 Tage nach Wochentag und Stunde (UTC).
          </p>
        </header>
        <Heatmap data={heatmap} />
        {topCount > 0 && topDow >= 0 && topHour >= 0 && (
          <p className="text-xs text-neutral-600">
            Spitze: <strong>{dowLabels[topDow]}</strong> um{' '}
            <strong>
              {topHour.toString().padStart(2, '0')}:00 – {topHour
                .toString()
                .padStart(2, '0')}:59 UTC
            </strong>{' '}
            mit {topCount} Klick{topCount === 1 ? '' : 's'}.
          </p>
        )}
      </section>

      {/* Herkunft */}
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <header>
          <h2 className="text-base font-semibold">Herkunft</h2>
          <p className="text-xs text-neutral-500">
            Top-Länder der letzten 90 Tage. Aus IP abgeleitet, IP wird nicht
            gespeichert.
          </p>
        </header>
        <CountryBreakdown data={countries} />
      </section>

      {/* Letzte Klicks */}
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <header>
          <h2 className="text-base font-semibold">
            Letzte Klicks ({recent.length})
          </h2>
          <p className="text-xs text-neutral-500">
            Bis zu 30 letzte Aufrufe – Crawler werden nicht mitgezählt.
          </p>
        </header>
        {recent.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
            Noch keine Klicks erfasst.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {recent.map((iso, i) => (
              <li key={i} className="py-1.5 font-mono text-xs text-neutral-700">
                {new Date(iso + 'Z').toLocaleString('de-DE')}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-3xl font-semibold tabular-nums text-neutral-900">
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
    </div>
  );
}

function CountryBreakdown({ data }: { data: CountryBreakdownEntry[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
        Noch keine Klicks in den letzten 90 Tagen.
      </div>
    );
  }

  const total = data.reduce((s, r) => s + r.count, 0);
  const top = data.slice(0, 10);
  const names = new Intl.DisplayNames(['de'], { type: 'region' });

  return (
    <ul className="space-y-1.5 text-sm">
      {top.map((row) => {
        const pct = total === 0 ? 0 : (row.count / total) * 100;
        const label = row.country
          ? `${row.country} – ${safeRegionName(names, row.country)}`
          : 'unbekannt';
        return (
          <li key={row.country ?? '__null__'} className="space-y-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-neutral-800">{label}</span>
              <span className="font-mono text-xs tabular-nums text-neutral-600">
                {row.count} · {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function safeRegionName(names: Intl.DisplayNames, code: string): string {
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

function DailyBarChart({
  data,
}: {
  data: { day: string; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const barW = 12;
  const gap = 2;
  const innerH = 80;
  const labelH = 14;
  const w = data.length * (barW + gap);
  const h = innerH + labelH;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height="auto"
      role="img"
      aria-label={`Tagesklicks der letzten ${data.length} Tage`}
    >
      {data.map((d, i) => {
        const barH = (d.count / max) * innerH;
        const x = i * (barW + gap);
        const y = innerH - barH;
        return (
          <g key={d.day}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(2, barH)}
              rx={2}
              fill={d.count > 0 ? '#1d284d' : '#e5e5e5'}
            >
              <title>
                {new Date(d.day + 'T00:00:00Z').toLocaleDateString('de-DE')}:{' '}
                {d.count} Klick{d.count === 1 ? '' : 's'}
              </title>
            </rect>
            {i % 5 === 0 && (
              <text
                x={x + barW / 2}
                y={innerH + labelH - 2}
                fontSize="8"
                fill="#737373"
                textAnchor="middle"
              >
                {new Date(d.day + 'T00:00:00Z').toLocaleDateString('de-DE', {
                  day: 'numeric',
                  month: 'numeric',
                })}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
