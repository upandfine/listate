import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-6 py-10 text-center">
      <div className="space-y-2">
        <div className="text-6xl font-semibold tracking-tight text-brand">
          404
        </div>
        <h1 className="text-xl font-semibold text-neutral-900">
          Seite nicht gefunden
        </h1>
        <p className="text-sm text-neutral-600">
          Die Adresse existiert nicht (mehr). Zurück zur Startseite oder
          ins Dashboard.
        </p>
      </div>
      <div className="flex justify-center gap-2">
        <Link
          href="/"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-dark"
        >
          Zur Startseite
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
