import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { count, desc, eq, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { Heatmap } from '@/app/components/Heatmap';
import { Sparkline } from '@/app/components/Sparkline';
import { getDb } from '@/db';
import { clicks, links, users } from '@/db/schema';
import { normalizeHost } from '@/lib/host';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Statistik (Admin)',
};

export default async function AdminStatsPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/');

  const db = getDb();

  // Aggregate gesamt
  const totalLinks = db.select({ n: count() }).from(links).get()?.n ?? 0;
  const totalClicks =
    db.select({ n: count() }).from(clicks).get()?.n ?? 0;
  const totalUsers =
    db.select({ n: count() }).from(users).get()?.n ?? 0;

  // Klicks letzte 7 / 30 / 90 Tage
  const since7 = isoUtcMinusDays(7);
  const since30 = isoUtcMinusDays(30);

  const clicks7 =
    db
      .select({ n: count() })
      .from(clicks)
      .where(sql`${clicks.clickedAt} > ${since7}`)
      .get()?.n ?? 0;
  const clicks30 =
    db
      .select({ n: count() })
      .from(clicks)
      .where(sql`${clicks.clickedAt} > ${since30}`)
      .get()?.n ?? 0;

  // Tagesreihe (90 Tage) für Sparkline
  const dailyRows = db
    .select({
      day: sql<string>`substr(${clicks.clickedAt}, 1, 10)`,
      n: sql<number>`COUNT(*)`,
    })
    .from(clicks)
    .where(sql`${clicks.clickedAt} > ${isoUtcMinusDays(90)}`)
    .groupBy(sql`substr(${clicks.clickedAt}, 1, 10)`)
    .all() as { day: string; n: number }[];
  const dailyMap = new Map(dailyRows.map((r) => [r.day, r.n]));
  const dailySeries: { day: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailySeries.push({ day: key, count: dailyMap.get(key) ?? 0 });
  }

  // Heatmap über alle Klicks der letzten 90 Tage
  const heatmapRows = db
    .select({
      dow: sql<string>`strftime('%w', ${clicks.clickedAt})`,
      hour: sql<string>`strftime('%H', ${clicks.clickedAt})`,
      n: sql<number>`COUNT(*)`,
    })
    .from(clicks)
    .where(sql`${clicks.clickedAt} > ${isoUtcMinusDays(90)}`)
    .groupBy(
      sql`strftime('%w', ${clicks.clickedAt})`,
      sql`strftime('%H', ${clicks.clickedAt})`
    )
    .all() as { dow: string; hour: string; n: number }[];
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );
  for (const r of heatmapRows) {
    const d = parseInt(r.dow, 10);
    const h = parseInt(r.hour, 10);
    if (d >= 0 && d < 7 && h >= 0 && h < 24) grid[d][h] = r.n;
  }

  // Top-Laender (90 Tage) — über alle Klicks aller Links
  const countryRows = db
    .select({
      country: clicks.countryCode,
      n: sql<number>`COUNT(*)`,
    })
    .from(clicks)
    .where(sql`${clicks.clickedAt} > ${isoUtcMinusDays(90)}`)
    .groupBy(clicks.countryCode)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(10)
    .all() as { country: string | null; n: number }[];
  const countryTotal = countryRows.reduce((s, r) => s + r.n, 0);
  const regionNames = new Intl.DisplayNames(['de'], { type: 'region' });

  // Top-User nach Anzahl Links + Klicks
  const topUsers = db
    .select({
      userId: links.userId,
      email: users.email,
      linkCount: sql<number>`COUNT(${links.id})`,
      clickSum: sql<number>`COALESCE(SUM(${links.clickCount}), 0)`,
    })
    .from(links)
    .leftJoin(users, eq(users.id, links.userId))
    .groupBy(links.userId, users.email)
    .orderBy(desc(sql`SUM(${links.clickCount})`))
    .limit(10)
    .all() as {
    userId: string;
    email: string | null;
    linkCount: number;
    clickSum: number;
  }[];

  // Top-Domains: alle Links holen, in JS nach Hostname gruppieren.
  // Bei großem Datenstand (>50k) sollte das in SQL laufen, aktuell egal.
  const allLinks = db
    .select({
      originalUrl: links.originalUrl,
      clickCount: links.clickCount,
    })
    .from(links)
    .all();
  const domainMap = new Map<
    string,
    { linkCount: number; clickCount: number }
  >();
  for (const l of allLinks) {
    let host = '';
    try {
      host = normalizeHost(new URL(l.originalUrl).hostname);
    } catch {
      continue;
    }
    const cur = domainMap.get(host) ?? { linkCount: 0, clickCount: 0 };
    cur.linkCount += 1;
    cur.clickCount += l.clickCount;
    domainMap.set(host, cur);
  }
  const topDomains = Array.from(domainMap.entries())
    .map(([host, v]) => ({ host, ...v }))
    .sort((a, b) => b.clickCount - a.clickCount)
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Statistik (Admin)</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Aggregierter Blick über alle Nutzer und Links.
        </p>
      </header>

      {/* Kennzahlen */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KPI label="Nutzer" value={totalUsers} />
        <KPI label="Links" value={totalLinks} />
        <KPI label="Klicks gesamt" value={totalClicks} />
        <KPI label="Klicks 30 Tage" value={clicks30} />
        <KPI label="Klicks 7 Tage" value={clicks7} />
      </section>

      {/* 90-Tage-Trend */}
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <header>
          <h2 className="text-base font-semibold">90-Tage-Trend</h2>
          <p className="text-xs text-neutral-500">
            Tägliche Gesamtklicks über alle Links.
          </p>
        </header>
        {dailySeries.some((d) => d.count > 0) ? (
          <Sparkline data={dailySeries} width={520} height={60} />
        ) : (
          <p className="text-sm text-neutral-500">Noch keine Klicks erfasst.</p>
        )}
      </section>

      {/* Heatmap */}
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <header>
          <h2 className="text-base font-semibold">Aktivste Slots</h2>
          <p className="text-xs text-neutral-500">
            Wochentag × Stunde, letzte 90 Tage (UTC).
          </p>
        </header>
        <Heatmap data={grid} />
      </section>

      {/* Top-Domains */}
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <header>
          <h2 className="text-base font-semibold">Top-Domains</h2>
          <p className="text-xs text-neutral-500">Sortiert nach Klicks.</p>
        </header>
        {topDomains.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Noch keine Links angelegt.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-1">Host</th>
                <th className="py-1 text-right">Links</th>
                <th className="py-1 text-right">Klicks</th>
              </tr>
            </thead>
            <tbody>
              {topDomains.map((d) => (
                <tr key={d.host} className="border-b border-neutral-100 last:border-0">
                  <td className="py-1.5 font-mono text-xs">{d.host}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {d.linkCount}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-medium">
                    {d.clickCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Top-Laender */}
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <header>
          <h2 className="text-base font-semibold">Top-Länder</h2>
          <p className="text-xs text-neutral-500">
            Aus IP abgeleitet (DSGVO: IP wird nicht gespeichert), letzte
            90 Tage.
          </p>
        </header>
        {countryRows.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Noch keine Klicks erfasst.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-1">Land</th>
                <th className="py-1 text-right">Klicks</th>
                <th className="py-1 text-right">Anteil</th>
              </tr>
            </thead>
            <tbody>
              {countryRows.map((r) => {
                const pct = countryTotal === 0 ? 0 : (r.n / countryTotal) * 100;
                const label = r.country
                  ? `${r.country} – ${(() => {
                      try {
                        return regionNames.of(r.country) ?? r.country;
                      } catch {
                        return r.country;
                      }
                    })()}`
                  : 'unbekannt';
                return (
                  <tr
                    key={r.country ?? '__null__'}
                    className="border-b border-neutral-100 last:border-0"
                  >
                    <td className="py-1.5 text-xs">{label}</td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {r.n}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-neutral-600">
                      {pct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Top-User */}
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <header>
          <h2 className="text-base font-semibold">Top-Nutzer</h2>
          <p className="text-xs text-neutral-500">
            Sortiert nach Gesamtklicks aller eigenen Links.
          </p>
        </header>
        {topUsers.length === 0 ? (
          <p className="text-sm text-neutral-500">Noch keine Nutzer.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-1">E-Mail</th>
                <th className="py-1 text-right">Links</th>
                <th className="py-1 text-right">Klicks</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((u) => (
                <tr
                  key={u.userId}
                  className="border-b border-neutral-100 last:border-0"
                >
                  <td className="py-1.5 text-xs">
                    <Link
                      href={`/dashboard?user=${encodeURIComponent(u.userId)}`}
                      className="text-brand hover:underline"
                    >
                      {u.email ?? u.userId}
                    </Link>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {u.linkCount}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-medium">
                    {u.clickSum}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
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

function isoUtcMinusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
