'use client';

import { useState } from 'react';

interface CreateResponse {
  trackingUrl: string;
  id: string;
  og: {
    title: string | null;
    description: string | null;
    image: string | null;
    siteName: string | null;
  };
}

export default function HomePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setCopied(false);
    setLoading(true);

    try {
      const res = await fetch('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen');
      }
      setResult(data);
      setUrl('');
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
        <div className="flex gap-2">
          <input
            id="url"
            type="url"
            required
            placeholder="https://example.com/artikel"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Erzeuge…' : 'Erzeugen'}
          </button>
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
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Tracking-Link
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
