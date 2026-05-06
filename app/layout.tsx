import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import './globals.css';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://listate.de';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Listate – Tracking-Links mit Vorschau',
    template: '%s · Listate',
  },
  description:
    'Erstelle Kurz-Links, die in WhatsApp, Slack und Co. die echte Vorschau der Originalseite zeigen – und zähle Klicks dabei mit.',
  applicationName: 'Listate',
  authors: [{ name: 'UP&FINE UG' }],
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: '/',
    siteName: 'Listate',
    title: 'Listate – Tracking-Links mit Vorschau',
    description:
      'Erstelle Kurz-Links, die in WhatsApp, Slack und Co. die echte Vorschau der Originalseite zeigen – und zähle Klicks dabei mit.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Listate – Tracking-Links mit Vorschau',
    description:
      'Kurz-Links mit echter Vorschau für WhatsApp, Slack und Co. – Klicks inklusive.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;
  const isAdmin = user?.role === 'admin';

  return (
    <html lang="de">
      <body>
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold text-neutral-900"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <path
                    d="M9 16 H22 M17 11 L22 16 L17 21"
                    stroke="#ffffff"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </span>
              Listate
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {user && (
                <>
                  <Link
                    href="/"
                    className="text-neutral-600 hover:text-neutral-900"
                  >
                    Neu
                  </Link>
                  <Link
                    href="/dashboard"
                    className="text-neutral-600 hover:text-neutral-900"
                  >
                    Dashboard
                  </Link>
                </>
              )}

              {user ? (
                <div className="flex items-center gap-2 border-l border-neutral-200 pl-4">
                  {user.image && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={user.image}
                      alt=""
                      className="h-7 w-7 rounded-full"
                    />
                  )}
                  <span className="hidden text-xs text-neutral-600 sm:inline">
                    {user.email}
                    {isAdmin && (
                      <span className="ml-1 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                        Admin
                      </span>
                    )}
                  </span>
                  <form
                    action={async () => {
                      'use server';
                      await signOut({ redirectTo: '/login' });
                    }}
                  >
                    <button
                      type="submit"
                      className="text-xs text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
                    >
                      Abmelden
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
                >
                  Anmelden
                </Link>
              )}
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
