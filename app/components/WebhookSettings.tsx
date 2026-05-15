'use client';

import { useState } from 'react';
import {
  clearWebhook,
  regenerateWebhookSecret,
  testWebhook,
  updateWebhook,
  type TestWebhookOk,
} from '@/app/actions/webhook';

interface WebhookSettingsProps {
  initialUrl: string;
  initialSecret: string | null;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'ok'; message: string }
  | { kind: 'err'; message: string };

export function WebhookSettings({
  initialUrl,
  initialSecret,
}: WebhookSettingsProps) {
  const [url, setUrl] = useState(initialUrl);
  const [secret, setSecret] = useState(initialSecret);
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);

  const isConfigured = Boolean(secret) && url.trim().length > 0;

  async function withBusy(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  async function onSave(formData: FormData) {
    await withBusy(async () => {
      setStatus({ kind: 'idle' });
      const res = await updateWebhook(formData);
      if (!res.ok) {
        setStatus({ kind: 'err', message: res.error });
        return;
      }
      // Beim ersten Save wurde serverseitig ein Secret erzeugt. Der naechste
      // Server-Refresh liefert es; bis dahin als „konfiguriert, exakter Wert
      // beim naechsten Page-Load sichtbar" anzeigen.
      if (!secret) setSecret('•');
      setStatus({ kind: 'ok', message: 'Webhook gespeichert.' });
    });
  }

  async function onRotate() {
    await withBusy(async () => {
      setStatus({ kind: 'idle' });
      const res = await regenerateWebhookSecret();
      if (!res.ok) {
        setStatus({ kind: 'err', message: res.error });
        return;
      }
      setStatus({
        kind: 'ok',
        message: 'Neues Secret erzeugt. Seite neu laden, um es zu sehen.',
      });
    });
  }

  async function onClear() {
    await withBusy(async () => {
      setStatus({ kind: 'idle' });
      const res = await clearWebhook();
      if (!res.ok) {
        setStatus({ kind: 'err', message: res.error });
        return;
      }
      setUrl('');
      setSecret(null);
      setRevealed(false);
      setStatus({ kind: 'ok', message: 'Webhook entfernt.' });
    });
  }

  async function onTest() {
    await withBusy(async () => {
      setStatus({ kind: 'idle' });
      const res = await testWebhook();
      if (!res.ok) {
        setStatus({ kind: 'err', message: res.error });
        return;
      }
      const data = (res as { ok: true; data: TestWebhookOk }).data;
      const isOk = data.status >= 200 && data.status < 300;
      const label = isOk
        ? `Empfaenger geantwortet mit HTTP ${data.status} (${data.durationMs} ms).`
        : `Empfaenger geantwortet mit HTTP ${data.status} (${data.durationMs} ms) — Klick-Webhooks werden bei 4xx NICHT wiederholt.`;
      setStatus({ kind: isOk ? 'ok' : 'err', message: label });
    });
  }

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold">Webhook bei Klick</h2>
      <p className="mt-2 text-sm text-neutral-600">
        Optionaler HTTPS-Endpoint, der bei jedem (Nicht-Crawler-)Klick auf
        einen deiner Tracking-Links per <code className="text-xs">POST</code>{' '}
        informiert wird. Geeignet fuer Slack-Bots, n8n-Flows, eigene
        Backends. Bei Fehler einmal nach 2&nbsp;s wiederholt, danach
        still verworfen.
      </p>

      <form
        action={onSave}
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <label htmlFor="webhook-url" className="sr-only">
          Webhook-URL
        </label>
        <input
          id="webhook-url"
          name="url"
          type="url"
          inputMode="url"
          placeholder="https://hooks.example.com/listate"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          maxLength={500}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          Speichern
        </button>
      </form>

      {isConfigured && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-[max-content,1fr] sm:items-center sm:gap-x-4">
            <span className="text-neutral-500">Signatur-Secret</span>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-neutral-100 px-2 py-1 font-mono text-xs">
                {revealed && secret && secret !== '•'
                  ? secret
                  : secret
                  ? `${'•'.repeat(8)}${secret.length > 4 ? secret.slice(-4) : ''}`
                  : '—'}
              </code>
              {secret && secret !== '•' && (
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                >
                  {revealed ? 'Verbergen' : 'Anzeigen'}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onTest}
              disabled={busy}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              Test-Payload senden
            </button>
            <button
              type="button"
              onClick={onRotate}
              disabled={busy}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              Secret neu erzeugen
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              className="rounded-md border border-accent/40 bg-white px-3 py-2 text-xs font-medium text-accent hover:bg-accent hover:text-white disabled:opacity-50"
            >
              Webhook entfernen
            </button>
          </div>
        </>
      )}

      {status.kind !== 'idle' && (
        <p
          role="status"
          className={`mt-3 text-sm ${
            status.kind === 'err' ? 'text-accent' : 'text-emerald-700'
          }`}
        >
          {status.message}
        </p>
      )}

      <details className="mt-4 text-sm text-neutral-600">
        <summary className="cursor-pointer font-medium">
          Payload-Format und Signatur
        </summary>
        <div className="mt-2 space-y-2">
          <p>Body (JSON) bei jedem Klick:</p>
          <pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs">
{`{
  "linkId": "abc123",
  "slug": "mein-slug",
  "originalUrl": "https://example.com/page",
  "clickedAt": "2026-05-13T12:00:00.000Z",
  "country": "DE",
  "userAgent": "Mozilla/5.0 ..."
}`}
          </pre>
          <p>Signatur-Header (wenn Secret gesetzt):</p>
          <pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs">
{`X-Listate-Signature: sha256=<HEX>`}
          </pre>
          <p className="text-xs text-neutral-500">
            HMAC-SHA256 ueber den exakten Request-Body, hexkodiert. Im
            Empfaenger validierbar mit z.&nbsp;B.{' '}
            <code className="text-xs">
              crypto.createHmac(&apos;sha256&apos;, secret).update(body).digest(&apos;hex&apos;)
            </code>
            .
          </p>
        </div>
      </details>
    </section>
  );
}
