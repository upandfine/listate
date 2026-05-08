import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Toaster } from 'sonner';
import { auth } from '@/auth';
import { Header } from './components/Header';
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
  themeColor: '#9b0a00',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user
    ? {
        email: session.user.email,
        image: session.user.image,
        role: session.user.role,
      }
    : null;

  return (
    // suppressHydrationWarning auf <html> + <body>, weil Browser-Extensions
    // (LanguageTool, Grammarly, Dark-Reader, …) Marker-Attribute injizieren,
    // die der Hydration-Reconciler sonst als Mismatch flaggt.
    <html lang="de" suppressHydrationWarning>
      <body
        className="flex min-h-screen flex-col"
        suppressHydrationWarning
      >
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            classNames: {
              toast: 'border border-neutral-200',
            },
          }}
        />
        <Header user={user} />
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
          {children}
        </main>
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
