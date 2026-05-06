import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'LinkTracker',
  description: 'Tracking-Links mit Open-Graph-Vorschau erstellen',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold">
              LinkTracker
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="text-neutral-600 hover:text-neutral-900">
                Neu
              </Link>
              <Link
                href="/dashboard"
                className="text-neutral-600 hover:text-neutral-900"
              >
                Dashboard
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-end gap-4 px-6 py-4 text-xs text-neutral-500">
            <Link href="/impressum" className="hover:text-neutral-900">
              Impressum
            </Link>
            <Link href="/datenschutz" className="hover:text-neutral-900">
              Datenschutz
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
