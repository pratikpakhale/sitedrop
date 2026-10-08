import { assertAuthorized, errorResponse } from '@/lib/auth'
import { listAll } from '@/lib/storage'
import { SITE_PREFIX } from '@sitedrop/core/config'
import { parseSiteKey } from '@sitedrop/core/keys'
import type { SiteSummary } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    assertAuthorized(request)

    const summaries = new Map<string, SiteSummary>()

    for (const object of await listAll(`${SITE_PREFIX}/`)) {
      const parsed = parseSiteKey(object.key)
      if (!parsed) continue

      const uploadedAt = object.lastModified.toISOString()
      const current = summaries.get(parsed.subdomain)

      if (!current) {
        summaries.set(parsed.subdomain, {
          subdomain: parsed.subdomain,
          files: 1,
          bytes: object.size,
          updatedAt: uploadedAt,
        })
        continue
      }

      current.files += 1
      current.bytes += object.size
      if (uploadedAt > current.updatedAt) current.updatedAt = uploadedAt
    }

    const sites = [...summaries.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return Response.json({ sites })
  } catch (error) {
    return errorResponse(error)
  }
}
