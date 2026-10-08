import { ROOT_DOMAIN } from './config'

function normalizeHost(host: string): string {
  return host.split(':')[0]!.trim().toLowerCase().replace(/\.$/, '')
}

export function rootHost(): string {
  return normalizeHost(ROOT_DOMAIN)
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
