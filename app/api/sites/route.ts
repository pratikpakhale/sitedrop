import { assertAuthorized, errorResponse } from '@/lib/auth'
import { listAll } from '@/lib/blob'
import { SITE_PREFIX } from '@/lib/config'
import { parseSiteKey } from '@/lib/keys'
import type { SiteSummary } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    assertAuthorized(request)

    const summaries = new Map<string, SiteSummary>()

    for (const blob of await listAll(`${SITE_PREFIX}/`)) {
      const parsed = parseSiteKey(blob.pathname)
      if (!parsed) continue

      const uploadedAt = blob.uploadedAt.toISOString()
      const current = summaries.get(parsed.subdomain)

      if (!current) {
        summaries.set(parsed.subdomain, {
          subdomain: parsed.subdomain,
          files: 1,
          bytes: blob.size,
          updatedAt: uploadedAt,
        })
        continue
      }

      current.files += 1
      current.bytes += blob.size
      if (uploadedAt > current.updatedAt) current.updatedAt = uploadedAt
    }

    const sites = [...summaries.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return Response.json({ sites })
  } catch (error) {
    return errorResponse(error)
  }
}
