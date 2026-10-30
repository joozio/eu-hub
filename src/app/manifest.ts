import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EU Hub – The European Union, Made Personal',
    short_name: 'EU Hub',
    description: 'Personalized EU news, statistics, and legislation for every EU citizen.',
    start_url: '/',
    display: 'standalone',
    background_color: '#003399',
    theme_color: '#003399',
    orientation: 'portrait-primary',
    scope: '/',
    categories: ['news', 'government', 'education'],
    lang: 'en',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: '/screenshot-wide.png',
        sizes: '1280x720',
        type: 'image/png',
      },
    ],
  };
}
