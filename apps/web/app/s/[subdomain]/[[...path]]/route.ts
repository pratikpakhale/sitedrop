import { SITE_CACHE_HEADERS, siteTag } from '@/lib/cdn'
import { subdomainFromHost } from '@/lib/host'
import { presignRead } from '@/lib/storage'
import { normalizeRelPath, siteKey } from '@sitedrop/core/keys'
import { contentTypeFor, looksLikeFile } from '@sitedrop/core/mime'
import { isValidSubdomain } from '@sitedrop/core/subdomain'

export const dynamic = 'force-dynamic'

const FORWARDED_RESPONSE_HEADERS = ['etag', 'content-length', 'last-modified']

type Context = { params: Promise<{ subdomain: string; path?: string[] }> }

/**
 * `/about` may be stored as `about.html` or `about/index.html`; `/` is always
 * `index.html`. An extensionless path is tried literally too, but last, so the
 * pretty-URL lookups stay on the fast path and an uploaded `LICENSE` still
 * resolves.
 */
function candidatesFor(relPath: string): string[] {
  if (relPath === '') return ['index.html']

  const lastSegment = relPath.split('/').pop() ?? ''
  if (looksLikeFile(lastSegment)) return [relPath]

  return [`${relPath}.html`, `${relPath}/index.html`, relPath]
}

/**
 * Always the whole object: the CDN caches this response for every visitor, so
 * a browser's `Range` or `If-None-Match` must not shape it. The CDN answers
 * those from its own copy.
 */
async function fetchObject(key: string): Promise<Response | null> {
  // `no-store` keeps this out of Next's fetch cache, which would both cap the
  // body at 2MB and buffer binary assets we only want to stream through.
  const upstream = await fetch(await presignRead(key), { cache: 'no-store' })
  if (upstream.status === 404) return null
  // A storage failure must not be dressed up as the file and cached as such.
  if (!upstream.ok) throw new Error(`Storage returned ${upstream.status} for ${key}`)
  return upstream
}

function render(subdomain: string, upstream: Response, key: string, status = 200): Response {
  const headers = new Headers({
    ...SITE_CACHE_HEADERS,
    'vercel-cache-tag': siteTag(subdomain),
    'content-type': contentTypeFor(key),
    'x-content-type-options': 'nosniff',
  })
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }

  return new Response(upstream.body, { status, headers })
}

function notFound(subdomain?: string): Response {
  const headers = new Headers({ 'content-type': 'text/plain; charset=utf-8' })
  if (subdomain) {
    for (const [name, value] of Object.entries(SITE_CACHE_HEADERS)) headers.set(name, value)
    headers.set('vercel-cache-tag', siteTag(subdomain))
  }
  return new Response('Not found', { status: 404, headers })
}

export async function GET(request: Request, context: Context) {
  const { subdomain, path } = await context.params

  // Only reachable through the host rewrite in next.config.ts. Served on any
  // other host, `/s/<name>/` would run a tenant's scripts on the apex origin,
  // next to the stored publish password.
  if (subdomainFromHost(request.headers.get('host') ?? '') !== subdomain) return notFound()
  if (!isValidSubdomain(subdomain)) return notFound()

  const segments = path ?? []
  const relPath = segments.length === 0 ? '' : normalizeRelPath(segments.join('/'))
  if (relPath === null) return notFound(subdomain)

  try {
    for (const candidate of candidatesFor(relPath)) {
      const upstream = await fetchObject(siteKey(subdomain, candidate))
      if (upstream) return render(subdomain, upstream, candidate)
    }

    const notFoundKey = siteKey(subdomain, '404.html')
    const custom = await fetchObject(notFoundKey)
    if (custom) return render(subdomain, custom, notFoundKey, 404)
  } catch {
    return new Response('Site storage unavailable', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  return notFound(subdomain)
}
