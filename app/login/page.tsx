import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

export const metadata: Metadata = {
  title: 'Anmelden – LinkTracker',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }

  const { callbackUrl } = await searchParams;

  return (
    <div className="mx-auto max-w-sm space-y-6 py-10">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Anmelden</h1>
        <p className="text-sm text-neutral-600">
          Bitte mit deinem Google-Konto anmelden, um Tracking-Links zu
          erstellen und das Dashboard zu öffnen.
        </p>
      </header>

      <form
        action={async () => {
          'use server';
          await signIn('google', {
            redirectTo: callbackUrl ?? '/',
          });
        }}
      >
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50"
        >
          <GoogleIcon />
          Mit Google anmelden
        </button>
      </form>

      <p className="text-center text-xs text-neutral-500">
        Beim Anmelden akzeptierst du die Verarbeitung deiner Konto-Daten
        gemäß <a href="/datenschutz" className="underline">Datenschutzerklärung</a>.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.614z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
