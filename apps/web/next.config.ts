import type { NextConfig } from 'next'
import { rootHost } from './lib/host'

const root = rootHost().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@sitedrop/core'],
  /**
   * Maps `<name>.<root>/<path>` onto the site route. A static rewrite rather
   * than proxy.ts, because Vercel resolves it in the CDN: proxy code would run
   * before the cache on every request, hits included. Exactly one label, as
   * the wildcard cert covers; `www` stays on the apex app.
   */
  rewrites: async () => ({
    beforeFiles: [
      {
        source: '/:path*',
        has: [{ type: 'host', value: `(?<subdomain>[^.]+)\\.${root}` }],
        missing: [{ type: 'host', value: `www\\.${root}` }],
        destination: '/s/:subdomain/:path*',
      },
    ],
    afterFiles: [],
    fallback: [],
  }),
}

export default nextConfig
