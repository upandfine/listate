'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOutAction } from '@/app/auth-actions';
import { BrandTile } from './BrandMark';

interface HeaderUser {
  email?: string | null;
  image?: string | null;
  role?: 'user' | 'admin';
}

export function Header({ user }: { user: HeaderUser | null }) {
  const isAdmin = user?.role === 'admin';
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Menü beim Routenwechsel automatisch schließen.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ESC schließt das Menü.
  useEffect(() => {
    if (!mobileOpen) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [mobileOpen]);

  const navLinks = user
    ? [
        { href: '/', label: 'Neu' },
        { href: '/templates', label: 'Vorlagen' },
        { href: '/dashboard', label: 'Dashboard' },
        ...(isAdmin
          ? [{ href: '/admin/blocked', label: 'Blockliste' }]
          : []),
        { href: '/settings', label: 'Einstellungen' },
      ]
    : [];

  return (
    <header className="relative border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold text-brand"
        >
          <BrandTile className="h-7 w-7" />
          Listate
        </Link>

        {/* Desktop-Nav */}
        <nav className="hidden items-center gap-4 text-sm md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-neutral-600 hover:text-neutral-900"
            >
              {l.label}
            </Link>
          ))}

          {user ? (
            <UserBlock user={user} isAdmin={isAdmin} />
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
            >
              Anmelden
            </Link>
          )}
        </nav>

        {/* Mobile-Toggle */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? 'Menü schließen' : 'Menü öffnen'}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 md:hidden"
        >
          {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
        </button>
      </div>

      {/* Mobile-Menü (aufklappbar) */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          className="absolute left-0 right-0 top-full z-30 border-b border-neutral-200 bg-white shadow-lg md:hidden"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-1 px-6 py-3 text-sm">
            {user ? (
              <>
                {navLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-md px-2 py-2 text-neutral-700 hover:bg-neutral-50"
                  >
                    {l.label}
                  </Link>
                ))}

                <div className="mt-2 flex items-center gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  {user.image && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={user.image}
                      alt=""
                      className="h-9 w-9 flex-shrink-0 rounded-full"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="truncate text-sm text-neutral-900">
                      {user.email}
                    </div>
                    {isAdmin && (
                      <span className="inline-block rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                        Admin
                      </span>
                    )}
                  </div>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                    >
                      Abmelden
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-md bg-brand px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-dark"
              >
                Anmelden
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function UserBlock({
  user,
  isAdmin,
}: {
  user: HeaderUser;
  isAdmin: boolean;
}) {
  return (
    <div className="flex items-center gap-2 border-l border-neutral-200 pl-4">
      {user.image && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={user.image} alt="" className="h-7 w-7 rounded-full" />
      )}
      <span className="hidden text-xs text-neutral-600 lg:inline">
        {user.email}
        {isAdmin && (
          <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            Admin
          </span>
        )}
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="text-xs text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
        >
          Abmelden
        </button>
      </form>
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="16" y2="6" />
      <line x1="4" y1="10" x2="16" y2="10" />
      <line x1="4" y1="14" x2="16" y2="14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="5" y1="5" x2="15" y2="15" />
      <line x1="15" y1="5" x2="5" y2="15" />
    </svg>
  );
}
