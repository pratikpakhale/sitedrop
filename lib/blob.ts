import { del, list, type ListBlobResultBlob } from '@vercel/blob'

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
