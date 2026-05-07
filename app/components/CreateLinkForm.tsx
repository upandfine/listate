'use client';

import { useState } from 'react';
import { TTL_LABELS, TTL_PRESETS, type TtlPreset } from '@/lib/ttl';

interface CreateResponse {
  trackingUrl: string;
  id: string;
  expiresAt: string | null;
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
    siteName: string | null;
  };
}

export default function CreateLinkForm() {
  // Nur der Teil hinter https:// – z. B. "www.upandfine.de/blog".
  const [host, setHost] = useState('');
  // Leerer String bedeutet "Kein Ablauf".
  const [ttl, setTtl] = useState<'' | TtlPreset>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Eingabe normalisieren: mitkopiertes http(s):// und führende Whitespace
  // entfernen, damit der Präfix nicht doppelt erscheint.
  function stripScheme(value: string): string {
    return value.replace(/^\s*https?:\/\//i, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = host.trim();
    if (!trimmed) return;

    setError(null);
    setResult(null);
    setCopied(false);
    setLoading(true);

    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `https://${trimmed}`,
          ttl: ttl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen');
      }
      setResult(data);
      setHost('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold">Tracking-Link erstellen</h1>
        <p className="mt-1 text-sm text-neutral-600">
          URL einfügen – wir generieren einen kurzen Link, der die
          Vorschau-Daten der Originalseite weiterreicht und Klicks zählt.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="url" className="block text-sm font-medium">
          Original-URL
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 rounded-md shadow-sm focus-within:ring-1 focus-within:ring-brand">
            <span className="inline-flex select-none items-center rounded-l-md border border-r-0 border-neutral-300 bg-neutral-100 px-3 font-mono text-sm text-neutral-500">
              https://
            </span>
            <input
              id="url"
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              placeholder="example.com/artikel"
              value={host}
              onChange={(e) => setHost(stripScheme(e.target.value))}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                if (/^\s*https?:\/\//i.test(pasted)) {
                  e.preventDefault();
                  setHost(stripScheme(pasted));
                }
              }}
              className="flex-1 rounded-r-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !host.trim()}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Erzeuge…' : 'Erzeugen'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <label
            htmlFor="ttl"
            className="text-xs font-medium text-neutral-600"
          >
            Gültigkeit
          </label>
          <select
            id="ttl"
            name="ttl"
            value={ttl}
            onChange={(e) => setTtl(e.target.value as '' | TtlPreset)}
            disabled={loading}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="">Kein Ablauf</option>
            {TTL_PRESETS.map((p) => (
              <option key={p} value={p}>
                {TTL_LABELS[p]}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-500">
            Nach Ablauf: Empfänger sehen einen Hinweis statt der Originalseite.
          </span>
        </div>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-neutral-500">
              <span>Tracking-Link</span>
              {result.expiresAt && (
                <span className="rounded bg-neutral-100 px-2 py-0.5 normal-case tracking-normal text-neutral-600">
                  läuft ab am{' '}
                  {new Date(result.expiresAt + 'Z').toLocaleString('de-DE')}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-neutral-100 px-3 py-2 text-sm">
                {result.trackingUrl}
              </code>
              <button
                onClick={() => copyToClipboard(result.trackingUrl)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                {copied ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>
          </div>

          <div className="border-t border-neutral-200 pt-4">
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Vorschau
            </div>
            <div className="mt-2 overflow-hidden rounded-md border border-neutral-200">
              {result.og.image && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={result.og.image}
                  alt=""
                  className="h-48 w-full object-cover"
                />
              )}
              <div className="space-y-1 p-4">
                {result.og.siteName && (
                  <div className="text-xs uppercase tracking-wide text-neutral-500">
                    {result.og.siteName}
                  </div>
                )}
                <div className="font-medium">
                  {result.og.title ?? '(kein Titel)'}
                </div>
                {result.og.description && (
                  <p className="text-sm text-neutral-600">
                    {result.og.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
