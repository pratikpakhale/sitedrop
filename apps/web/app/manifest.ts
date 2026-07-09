import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'site drop',
    short_name: 'site drop',
    description: 'Drop a folder or a .zip, get a live site on a subdomain.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9f7f4',
    theme_color: '#f9f7f4',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  }
}
