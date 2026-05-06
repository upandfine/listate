import { headers } from 'next/headers';

export function getBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  try {
    const h = headers();
    const host = h.get('host');
    const proto = h.get('x-forwarded-proto') ?? 'http';
    if (host) return `${proto}://${host}`;
  } catch {
    // not in a request context
  }

  return 'http://localhost:3000';
}
