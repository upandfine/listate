'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Channel {
  id: string;
  label: string;
  href: (url: string) => string;
  icon: ReactNode;
}

const CHANNELS: Channel[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: (u) => `https://wa.me/?text=${encodeURIComponent(u)}`,
    icon: <WhatsappIcon />,
  },
  {
    id: 'email',
    label: 'E-Mail',
    href: (u) => `mailto:?body=${encodeURIComponent(u)}`,
    icon: <MailIcon />,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    href: (u) => `https://t.me/share/url?url=${encodeURIComponent(u)}`,
    icon: <TelegramIcon />,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: (u) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}`,
    icon: <LinkedInIcon />,
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    href: (u) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}`,
    icon: <TwitterIcon />,
  },
  {
    id: 'sms',
    label: 'SMS',
    href: (u) => `sms:?&body=${encodeURIComponent(u)}`,
    icon: <SmsIcon />,
  },
];

export function ShareButton({
  value,
  className,
  label = 'Teilen',
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hasNativeShare, setHasNativeShare] = useState(false);

  useEffect(() => {
    setHasNativeShare(
      typeof navigator !== 'undefined' && typeof navigator.share === 'function'
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  async function shareNative() {
    setOpen(false);
    try {
      await navigator.share({ url: value });
    } catch {
      // User hat abgebrochen oder Browser unterstützt's nicht – ignorieren.
    }
  }

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${label} ${value}`}
        className={
          className ??
          'inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50'
        }
      >
        <ShareIcon />
        {label}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          {hasNativeShare && (
            <button
              type="button"
              role="menuitem"
              onClick={shareNative}
              className="flex w-full items-center gap-3 border-b border-neutral-100 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <span className="flex-shrink-0 text-brand">
                <ShareIcon />
              </span>
              Über System teilen
            </button>
          )}
          {CHANNELS.map((ch) => (
            <a
              key={ch.id}
              role="menuitem"
              href={ch.href(value)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <span className="flex-shrink-0 text-neutral-500">{ch.icon}</span>
              {ch.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Icons (alle 14×14, currentColor) ----------------------------------

function ShareIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="3.5" cy="8" r="1.6" />
      <circle cx="12.5" cy="3.5" r="1.6" />
      <circle cx="12.5" cy="12.5" r="1.6" />
      <path d="M5 7 L11 4" />
      <path d="M5 9 L11 12" />
    </svg>
  );
}

function WhatsappIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.05 4.91A9.82 9.82 0 0 0 12 2a9.94 9.94 0 0 0-8.6 14.93L2 22l5.24-1.37A9.92 9.92 0 0 0 12 22a9.94 9.94 0 0 0 7.05-17.09zM12 20.32a8.27 8.27 0 0 1-4.21-1.15l-.3-.18-3.11.81.83-3-.2-.31A8.26 8.26 0 1 1 12 20.32zm4.55-6.18c-.25-.13-1.47-.72-1.7-.81s-.4-.13-.56.13-.64.81-.79.97-.29.18-.54.06a6.78 6.78 0 0 1-2-1.23 7.5 7.5 0 0 1-1.39-1.72c-.15-.25 0-.39.11-.51s.25-.29.37-.43a1.71 1.71 0 0 0 .25-.41.46.46 0 0 0 0-.43c-.06-.13-.56-1.34-.77-1.84s-.4-.42-.56-.43h-.48a.91.91 0 0 0-.66.31 2.78 2.78 0 0 0-.87 2.07 4.85 4.85 0 0 0 1 2.55 11.05 11.05 0 0 0 4.22 3.71 5.07 5.07 0 0 0 3 .63 2.49 2.49 0 0 0 1.65-1.16 2 2 0 0 0 .14-1.16c-.06-.1-.21-.16-.46-.29z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 4.5 L8 9 L13.5 4.5" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19l-9.49 5.99-4.09-1.28c-.88-.27-.89-.88.2-1.31l15.9-6.13c.73-.27 1.43.18 1.15 1.31l-2.71 12.78c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.339 18.337v-8.59H5.667v8.59zM7.003 8.574a1.548 1.548 0 1 1 0-3.096 1.548 1.548 0 0 1 0 3.096zm11.335 9.763v-4.706c0-2.515-1.345-3.686-3.137-3.686a2.708 2.708 0 0 0-2.46 1.355v-1.163h-2.66c.034.755 0 8.59 0 8.59h2.66V13.54a1.81 1.81 0 0 1 .087-.65 1.456 1.456 0 0 1 1.366-.973c.964 0 1.485.67 1.485 1.65v4.77z" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function SmsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3 H13 a1 1 0 0 1 1 1 V10 a1 1 0 0 1 -1 1 H8 L5 14 V11 H3 a1 1 0 0 1 -1 -1 V4 a1 1 0 0 1 1 -1 z" />
    </svg>
  );
}
