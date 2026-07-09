import type { MetadataRoute } from 'next'

/** Covers the apex only. Published sites are served from Blob and keep their own robots.txt. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  }
}
