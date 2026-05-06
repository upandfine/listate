import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://listate.de';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${baseUrl}/`, lastModified, changeFrequency: 'monthly', priority: 1 },
    {
      url: `${baseUrl}/datenschutz`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/impressum`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
