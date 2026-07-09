import { del, list, rename, type ListBlobResultBlob } from '@vercel/blob'
import { parseSiteKey, siteKey, sitePrefix } from './keys'
import { baseContentTypeFor } from './mime'

const RENAME_CONCURRENCY = 8

let originCache: Promise<string> | null = null

/**
 * Public origin of the Blob store. With `addRandomSuffix: false` every blob
 * lives at `<origin>/<pathname>`, so one lookup lets us build asset URLs
 * directly instead of paying a `head()` round-trip per request.
 */
export function blobOrigin(): Promise<string> {
  const configured = process.env.BLOB_BASE_URL
  if (configured) return Promise.resolve(configured.replace(/\/+$/, ''))

  originCache ??= list({ limit: 1 })
    .then(({ blobs }) => {
      const first = blobs[0]
      if (!first) throw new Error('Blob store is empty; cannot derive its origin')
      return new URL(first.url).origin
    })
    .catch((error: unknown) => {
      originCache = null
      throw error
    })

  return originCache
}

export async function listAll(prefix: string): Promise<ListBlobResultBlob[]> {
  const all: ListBlobResultBlob[] = []
  let cursor: string | undefined

  do {
    const page = await list({ prefix, cursor, limit: 1000 })
    all.push(...page.blobs)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  return all
}

export async function siteExists(prefix: string): Promise<boolean> {
  const { blobs } = await list({ prefix, limit: 1 })
  return blobs.length > 0
}

export async function deletePathnames(pathnames: string[]): Promise<void> {
  for (let i = 0; i < pathnames.length; i += 100) {
    await del(pathnames.slice(i, i + 100))
  }
}

async function pool<T>(items: T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await work(items[next++]!)
  })
  await Promise.all(workers)
}

/**
 * Blob has no directory move, so each key is renamed individually. `rename`
 * leaves the source in place if its copy fails, so a mid-flight error strands
 * the site across both prefixes rather than losing files.
 */
export async function renameSite(from: string, to: string): Promise<number> {
  const blobs = await listAll(sitePrefix(from))

  await pool(blobs, RENAME_CONCURRENCY, async (blob) => {
    const parsed = parseSiteKey(blob.pathname)
    if (!parsed) return

    await rename(blob.pathname, siteKey(to, parsed.relPath), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: baseContentTypeFor(parsed.relPath),
    })
  })

  return blobs.length
}
