'use client';

import { useState, useTransition } from 'react';
import { createTemplate, testTemplatePattern } from '@/app/actions';
import type { ResolveResult } from '@/lib/resolveTemplateUrl';

export function TemplateForm() {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [pattern, setPattern] = useState('');
  const [testResult, setTestResult] = useState<ResolveResult | null>(null);
  const [isTesting, startTesting] = useTransition();

  function runTest() {
    setTestResult(null);
    startTesting(async () => {
      const result = await testTemplatePattern({ url, pattern });
      setTestResult(result);
    });
  }

  return (
    <form
      action={async (formData) => {
        await createTemplate(formData);
        // Nach Erfolg Felder leeren
        setLabel('');
        setUrl('');
        setDescription('');
        setPattern('');
        setTestResult(null);
      }}
      className="mt-4 space-y-4"
    >
      <div className="space-y-1">
        <label
          htmlFor="label"
          className="block text-sm font-medium text-neutral-700"
        >
          Bezeichnung
        </label>
        <input
          id="label"
          name="label"
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Leben ist mehr – Tagesvers"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="url"
          className="block text-sm font-medium text-neutral-700"
        >
          Ziel- bzw. Quell-URL
        </label>
        <input
          id="url"
          name="url"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.lebenistmehr.de/leben-ist-mehr.html"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <p className="text-xs text-neutral-500">
          Statisch ohne Pattern. Mit Pattern wird die Seite als Übersicht
          gelesen und der erste matchende Link genommen.
        </p>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="description"
          className="block text-sm font-medium text-neutral-700"
        >
          Beschreibung (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Was ist das, wann sinnvoll zu teilen?"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="urlPattern"
          className="block text-sm font-medium text-neutral-700"
        >
          Link-Pattern (Regex, optional)
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="urlPattern"
            name="urlPattern"
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="^https://www\.bibelliga\.org/vers-des-tages-[^/]+/$"
            className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            type="button"
            onClick={runTest}
            disabled={isTesting || !url || !pattern}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTesting ? 'Teste…' : 'Auflösen testen'}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Wenn gesetzt, wird beim „Link erzeugen" die Quellseite geladen
          und der erste <code>&lt;a href&gt;</code> genommen, der dem
          Regex entspricht.
        </p>
      </div>

      {testResult && <TestResultDisplay result={testResult} />}

      <div>
        <button
          type="submit"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
        >
          Vorlage anlegen
        </button>
      </div>
    </form>
  );
}

function TestResultDisplay({ result }: { result: ResolveResult }) {
  if (result.ok && result.resolved) {
    return (
      <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
        <div className="font-medium text-emerald-900">→ Treffer</div>
        <code className="block break-all text-xs text-emerald-900">
          {result.resolved}
        </code>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
      <div className="font-medium text-amber-900">
        Kein Treffer
        {result.error && (
          <span className="font-normal"> – {result.error}</span>
        )}
      </div>
      {result.candidates.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-amber-900">
            Kandidaten (erste {result.candidates.length}):
          </div>
          <ul className="space-y-0.5 text-xs text-amber-900">
            {result.candidates.map((c) => (
              <li key={c} className="break-all font-mono">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
