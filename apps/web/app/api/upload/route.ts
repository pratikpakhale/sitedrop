import { assertAuthorized, errorResponse } from '@/lib/auth'
import { presignUpload } from '@/lib/storage'
import { MAX_FILE_BYTES, MAX_FILES_PER_SITE } from '@sitedrop/core/config'
import { normalizeRelPath, siteKey } from '@sitedrop/core/keys'
import { baseContentTypeFor } from '@sitedrop/core/mime'
import type { UploadRequest, UploadTarget } from '@sitedrop/core/publish'
import { validateSubdomain } from '@sitedrop/core/subdomain'

export const runtime = 'nodejs'

/**
 * Signs one PUT URL per file. The browser or CLI uploads straight to R2 with
 * them, so asset size is never bounded by the 4.5MB serverless request body
 * limit, and no client ever holds R2 credentials.
 */
export async function POST(request: Request) {
  try {
    assertAuthorized(request)

    const { subdomain, files } = (await request.json()) as Partial<UploadRequest>

    if (typeof subdomain !== 'string') throw new Error('subdomain is required')
    const invalid = validateSubdomain(subdomain)
    if (invalid) throw new Error(`Subdomain "${subdomain}" is ${invalid}`)

    if (!Array.isArray(files) || files.length === 0) throw new Error('files must be a non-empty array')
    if (files.length > MAX_FILES_PER_SITE) {
      throw new Error(`A site may contain at most ${MAX_FILES_PER_SITE} files`)
    }

    const uploads: UploadTarget[] = await Promise.all(
      files.map(async ({ relPath: raw, size }) => {
        const relPath = typeof raw === 'string' ? normalizeRelPath(raw) : null
        if (!relPath) throw new Error(`Invalid path: ${String(raw)}`)
        if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Invalid size for ${relPath}`)
        if (size > MAX_FILE_BYTES) {
          throw new Error(`${relPath} exceeds the ${MAX_FILE_BYTES / 1024 / 1024}MB per-file limit`)
        }

        const contentType = baseContentTypeFor(relPath)
        const url = await presignUpload(siteKey(subdomain, relPath), contentType, size)
        return { relPath, url, headers: { 'content-type': contentType } }
      }),
    )

    return Response.json({ uploads })
  } catch (error) {
    return errorResponse(error)
  }
}
