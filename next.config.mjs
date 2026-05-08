/** @type {import('next').NextConfig} */

// Security-Header für alle Routen.
//   - HSTS: Browser zwingen HTTPS für 2 Jahre + Subdomains
//   - X-Content-Type-Options: kein MIME-Sniffing
//   - X-Frame-Options + frame-ancestors: kein Embedding (Clickjacking-Schutz)
//   - Referrer-Policy: minimaler Referrer in Cross-Origin-Requests
//   - Permissions-Policy: deaktiviert ungenutzte Browser-APIs
//   - CSP bewusst pragmatisch:
//     'unsafe-inline' für script und style ist nötig, weil Next.js
//     Inline-Bootstrap-Scripts setzt und der Tracking-Endpoint
//     /t/[id] eine eigene HTML-Antwort mit Inline-Script generiert.
//     Echte Härtung erfordert Nonces über Middleware (Backlog D).
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Inline-Scripts: Next.js-Bootstrap + Tracking-Redirect /t/[id]
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind generiert teilweise inline-Styles
      "style-src 'self' 'unsafe-inline'",
      // OG-Bilder von externen Hosts (jeder https-Server der eine Vorschau liefert)
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // Google-OAuth + Safe-Browsing-API + own
      "connect-src 'self' https://safebrowsing.googleapis.com https://accounts.google.com",
      // Auth.js braucht Form-Submit zu /api/auth/...
      "form-action 'self' https://accounts.google.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
    outputFileTracingIncludes: {
      '/**': [
        './node_modules/better-sqlite3/**/*',
        './lib/blocklists/**/*',
      ],
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
