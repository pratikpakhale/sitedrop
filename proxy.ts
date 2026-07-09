import { NextResponse, type NextRequest } from 'next/server'
import { normalizeHost, rootHost, subdomainFromHost } from './lib/subdomain'

export const config = {
  matcher: ['/((?!api/|_next/|favicon.ico).*)'],
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // `/s/*` is the internal rewrite target; it must not be addressable directly.
  if (pathname === '/s' || pathname.startsWith('/s/')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const host = normalizeHost(request.headers.get('host') ?? '')
  const root = rootHost()

  const isApex = host === root || host === `www.${root}`
  const isTenantHost = host.endsWith(`.${root}`) && !isApex
  if (!isTenantHost) return NextResponse.next()

  const subdomain = subdomainFromHost(host)
  if (!subdomain) return new NextResponse('Not found', { status: 404 })

  return NextResponse.rewrite(new URL(`/s/${subdomain}${pathname}`, request.url))
}
