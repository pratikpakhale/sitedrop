import { dangerouslyDeleteByTag } from '@vercel/functions'

/**
 * Site responses sit in Vercel's CDN until a write purges them, so a hit never
 * invokes a function or touches R2. Browsers always revalidate against the CDN,
 * which answers from its copy.
 */
export const SITE_CACHE_HEADERS = {
  'cache-control': 'public, max-age=0, must-revalidate',
  'vercel-cdn-cache-control': 'max-age=31536000',
}

export function siteTag(subdomain: string): string {
  return `site:${subdomain}`
}

/**
 * Deletes rather than invalidates: invalidation serves the stale copy once more,
 * so the first visit after a redeploy would show the old site. A no-op outside
 * Vercel.
 */
export function purgeSites(...subdomains: string[]): Promise<void> {
  return dangerouslyDeleteByTag(subdomains.map(siteTag))
}
