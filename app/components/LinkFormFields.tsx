'use client';

/**
 * Geteilte Eingabe-Logik fuer CreateLinkForm und EditLinkButton.
 *
 * Vorher waren Slug-/Tags-Markup, das Slug-Sanitizing und das
 * Scheme-Stripping in beiden Komponenten verbatim dupliziert.
 */

/** Entfernt fuehrenden Whitespace + mitkopiertes http(s)://. */
export function stripScheme(value: string): string {
  return value.replace(/^\s*https?:\/\//i, '');
}

/** Client-seitige Slug-Normalisierung (Server validiert zusaetzlich via Zod). */
export function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');
}

const INPUT_CLASS =
  'flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1 font-mono shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';
const TEXT_INPUT_CLASS =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

export function SlugField({
  id,
  label,
  placeholder,
  helpText,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  placeholder: string;
  helpText: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-neutral-700"
      >
        {label}
      </label>
      <div className="flex items-center gap-1 font-mono text-xs">
        <span className="text-neutral-500">listate.de/t/</span>
        <input
          id={id}
          name="slug"
          type="text"
          value={value}
          onChange={(e) => onChange(sanitizeSlug(e.target.value))}
          placeholder={placeholder}
          maxLength={64}
          disabled={disabled}
          className={INPUT_CLASS}
        />
      </div>
      <p className="text-xs text-neutral-500">{helpText}</p>
    </div>
  );
}

export function TagsField({
  id,
  label,
  helpText,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  helpText?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-neutral-700"
      >
        {label}
      </label>
      <input
        id={id}
        name="tags"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="newsletter, predigt, mai-2026"
        disabled={disabled}
        className={TEXT_INPUT_CLASS}
      />
      {helpText && <p className="text-xs text-neutral-500">{helpText}</p>}
    </div>
  );
}
