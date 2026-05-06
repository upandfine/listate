import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Listate',
    short_name: 'Listate',
    description:
      'Tracking-Links mit Open-Graph-Vorschau für WhatsApp, Slack & Co.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#0a0a0a',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
