import { presignRead } from '@/lib/storage'
import { normalizeRelPath, siteKey } from '@sitedrop/core/keys'
import { contentTypeFor, looksLikeFile } from '@sitedrop/core/mime'
import { isValidSubdomain } from '@sitedrop/core/subdomain'

export const dynamic = 'force-dynamic'

const CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400'
const FORWARDED_REQUEST_HEADERS = ['range', 'if-none-match', 'if-modified-since']
const FORWARDED_RESPONSE_HEADERS = ['etag', 'content-length', 'content-range', 'accept-ranges', 'last-modified']

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

async function fetchObject(request: Request, key: string): Promise<Response | null> {
  const headers = new Headers()
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  // `no-store` keeps this out of Next's fetch cache, which would both cap the
  // body at 2MB and buffer binary assets we only want to stream through.
  const upstream = await fetch(await presignRead(key), { headers, cache: 'no-store' })
  if (upstream.status === 404) return null
  // A storage failure must not be dressed up as the file and cached as such.
  if (upstream.status >= 400 && upstream.status !== 416) {
    throw new Error(`Storage returned ${upstream.status} for ${key}`)
  }
  return upstream
}

function render(upstream: Response, key: string, status?: number): Response {
  const headers = new Headers({
    'content-type': contentTypeFor(key),
    'cache-control': CACHE_CONTROL,
    'x-content-type-options': 'nosniff',
  })
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }

  return new Response(upstream.body, { status: status ?? upstream.status, headers })
}

export async function GET(request: Request, context: Context) {
  const { subdomain, path } = await context.params
  if (!isValidSubdomain(subdomain)) return new Response('Not found', { status: 404 })

  const segments = path ?? []
  const relPath = segments.length === 0 ? '' : normalizeRelPath(segments.join('/'))
  if (relPath === null) return new Response('Not found', { status: 404 })

  try {
    for (const candidate of candidatesFor(relPath)) {
      const upstream = await fetchObject(request, siteKey(subdomain, candidate))
      if (upstream) return render(upstream, candidate)
    }

    const notFoundKey = siteKey(subdomain, '404.html')
    const custom = await fetchObject(request, notFoundKey)
    if (custom) return render(custom, notFoundKey, 404)
  } catch {
    return new Response('Site storage unavailable', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    })
  }

  return new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': CACHE_CONTROL },
  })
}
