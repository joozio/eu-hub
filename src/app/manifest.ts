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
    ],
  };
}
