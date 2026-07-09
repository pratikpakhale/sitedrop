import { assertAuthorized, errorResponse } from '@/lib/auth'
import { MAX_FILES_PER_SITE } from '@/lib/config'
import { deletePathnames, listAll } from '@/lib/blob'
import { normalizeRelPath, siteKey, sitePrefix } from '@/lib/keys'
import { isAllowedFile } from '@/lib/mime'
import { validateSubdomain } from '@/lib/subdomain'

export const runtime = 'nodejs'

type CommitRequest = { subdomain?: unknown; relPaths?: unknown }

/**
 * Closes out a publish: everything under the site's prefix that was not part of
 * this upload is deleted, so a redeploy cannot leave orphaned files behind.
 */
export async function POST(request: Request) {
  try {
    assertAuthorized(request)

    const { subdomain, relPaths } = (await request.json()) as CommitRequest

    if (typeof subdomain !== 'string') throw new Error('subdomain is required')
    const invalid = validateSubdomain(subdomain)
    if (invalid) throw new Error(`Subdomain "${subdomain}" is ${invalid}`)

    if (!Array.isArray(relPaths) || relPaths.length === 0) {
      throw new Error('relPaths must be a non-empty array')
    }
    if (relPaths.length > MAX_FILES_PER_SITE) {
      throw new Error(`A site may contain at most ${MAX_FILES_PER_SITE} files`)
    }

    const keep = new Set<string>()
    for (const entry of relPaths) {
      if (typeof entry !== 'string') throw new Error('relPaths must contain only strings')
      const relPath = normalizeRelPath(entry)
      if (!relPath || !isAllowedFile(relPath)) throw new Error(`Invalid path: ${entry}`)
      keep.add(siteKey(subdomain, relPath))
    }

    if (!keep.has(siteKey(subdomain, 'index.html'))) {
      throw new Error('A site must include an index.html at its root')
    }

    const existing = await listAll(sitePrefix(subdomain))
    const stale = existing.map((blob) => blob.pathname).filter((pathname) => !keep.has(pathname))
    await deletePathnames(stale)

    return Response.json({ subdomain, files: keep.size, pruned: stale.length })
  } catch (error) {
    return errorResponse(error)
  }
}
