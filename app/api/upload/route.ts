import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { assertAuthorized, errorResponse } from '@/lib/auth'
import { MAX_FILE_BYTES } from '@/lib/config'
import { parseSiteKey } from '@/lib/keys'
import { baseContentTypeFor, isAllowedFile } from '@/lib/mime'
import { validateSubdomain } from '@/lib/subdomain'

export const runtime = 'nodejs'

/**
 * Mints a short-lived, single-pathname Blob token. The browser or CLI uploads
 * straight to Blob with it, so asset size is never bounded by the 4.5MB
 * serverless request body limit.
 */
export async function POST(request: Request) {
  let body: HandleUploadBody
  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return Response.json({ error: 'Expected a JSON body' }, { status: 400 })
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        assertAuthorized(request)

        const parsed = parseSiteKey(pathname)
        if (!parsed) throw new Error(`Refusing to write outside a site namespace: ${pathname}`)

        const invalid = validateSubdomain(parsed.subdomain)
        if (invalid) throw new Error(`Subdomain "${parsed.subdomain}" is ${invalid}`)

        if (!isAllowedFile(parsed.relPath)) {
          throw new Error(`File type not allowed: ${parsed.relPath}`)
        }

        return {
          addRandomSuffix: false,
          allowOverwrite: true,
          maximumSizeInBytes: MAX_FILE_BYTES,
          allowedContentTypes: [baseContentTypeFor(parsed.relPath)],
          validUntil: Date.now() + 60_000,
        }
      },
    })

    return Response.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
