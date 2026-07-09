import type { SiteSummary } from './types'

async function decode<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`)
  return payload
}

export function fetchSites(password: string): Promise<SiteSummary[]> {
  return fetch('/api/sites', { headers: { authorization: `Bearer ${password}` } })
    .then((response) => decode<{ sites: SiteSummary[] }>(response))
    .then((payload) => payload.sites)
}

export function deleteSite(password: string, subdomain: string): Promise<unknown> {
  return fetch(`/api/sites/${subdomain}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${password}` },
  }).then(decode)
}

export function renameSite(password: string, from: string, to: string): Promise<{ subdomain: string }> {
  return fetch(`/api/sites/${from}`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${password}`, 'content-type': 'application/json' },
    body: JSON.stringify({ to }),
  }).then(decode<{ subdomain: string }>)
}
