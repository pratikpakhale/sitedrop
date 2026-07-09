import { SITE_PREFIX } from './config'
import { isWellFormedLabel } from './subdomain'

/** Rejects anything that would let a key escape its `sites/<sub>/` namespace. */
export function normalizeRelPath(input: string): string | null {
  const raw = input.replace(/\\/g, '/').replace(/^\/+/, '')
  if (raw.length === 0 || raw.length > 1024) return null
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(raw)) return null

  const segments = raw.split('/')
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return null

  return segments.join('/')
}

export function siteKey(subdomain: string, relPath: string): string {
  return `${SITE_PREFIX}/${subdomain}/${relPath}`
}

export function sitePrefix(subdomain: string): string {
  return `${SITE_PREFIX}/${subdomain}/`
}

export type ParsedKey = { subdomain: string; relPath: string }

/** Structural parse only; callers apply reserved-name policy so they can report it accurately. */
export function parseSiteKey(key: string): ParsedKey | null {
  const segments = key.split('/')
  if (segments.length < 3) return null
  if (segments[0] !== SITE_PREFIX) return null

  const subdomain = segments[1]!
  if (!isWellFormedLabel(subdomain)) return null

  const relPath = normalizeRelPath(segments.slice(2).join('/'))
  if (relPath === null) return null

  return { subdomain, relPath }
}

/** Blob pathnames are URL path segments; encode each one so `#`, `?`, spaces survive. */
export function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}
