import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://listate.de';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/datenschutz', '/impressum', '/login'],
        disallow: ['/dashboard', '/api/', '/t/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
