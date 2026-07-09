import { assertAuthorized, errorResponse } from '@/lib/auth'
import { MAX_FILES_PER_SITE } from '@sitedrop/core/config'
import { deletePathnames, listAll } from '@/lib/blob'
import { normalizeRelPath, siteKey, sitePrefix } from '@sitedrop/core/keys'
import { INDEX } from '@sitedrop/core/prepare'
import { validateSubdomain } from '@sitedrop/core/subdomain'

export const runtime = 'nodejs'

type CommitRequest = { subdomain?: unknown; relPaths?: unknown; force?: unknown }

/**
 * Closes out a publish: everything under the site's prefix that was not part of
 * this upload is deleted, so a redeploy cannot leave orphaned files behind.
 */
export async function POST(request: Request) {
  try {
    assertAuthorized(request)

    const { subdomain, relPaths, force } = (await request.json()) as CommitRequest

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
      if (!relPath) throw new Error(`Invalid path: ${entry}`)
      keep.add(siteKey(subdomain, relPath))
    }

    if (force !== true && !keep.has(siteKey(subdomain, INDEX))) {
      throw new Error(`No ${INDEX} at the root. Send force: true to publish without a landing page.`)
    }

    const existing = await listAll(sitePrefix(subdomain))
    const stale = existing.map((blob) => blob.pathname).filter((pathname) => !keep.has(pathname))
    await deletePathnames(stale)

    return Response.json({ subdomain, files: keep.size, pruned: stale.length })
  } catch (error) {
    return errorResponse(error)
  }
}
