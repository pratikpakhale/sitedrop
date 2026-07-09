import { RESERVED_SUBDOMAINS, ROOT_DOMAIN } from './config'

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function normalizeHost(host: string): string {
  return host.split(':')[0]!.trim().toLowerCase().replace(/\.$/, '')
}

export function rootHost(): string {
  return normalizeHost(ROOT_DOMAIN)
}

export type SubdomainError = 'malformed' | 'reserved'

/** Shape only. Says nothing about whether the label is allowed to be a site. */
export function isWellFormedLabel(sub: string): boolean {
  return LABEL.test(sub)
}

export function validateSubdomain(sub: string): SubdomainError | null {
  if (!isWellFormedLabel(sub)) return 'malformed'
  if (RESERVED_SUBDOMAINS.has(sub)) return 'reserved'
  return null
}

export function isValidSubdomain(sub: string): boolean {
  return validateSubdomain(sub) === null
}

/**
 * Returns the tenant label for a host, or null when the host is the apex, an
 * unrelated host (a *.vercel.app preview), or a multi-level name. A wildcard
 * cert covers exactly one label, so `a.b.site.pakhale.com` is not a site.
 */
export function subdomainFromHost(host: string): string | null {
  const h = normalizeHost(host)
  const root = rootHost()
  if (h === root || h === `www.${root}`) return null
  if (!h.endsWith(`.${root}`)) return null

  const label = h.slice(0, h.length - root.length - 1)
  if (label.includes('.')) return null
  return label
}
