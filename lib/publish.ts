import { upload } from '@vercel/blob/client'
import { MAX_FILES_PER_SITE } from './config'
import { normalizeRelPath, siteKey } from './keys'
import { baseContentTypeFor } from './mime'
import { validateSubdomain } from './subdomain'

const MULTIPART_THRESHOLD = 5 * 1024 * 1024

const IGNORED_NAMES = new Set(['Thumbs.db', 'desktop.ini'])
const IGNORED_DIRS = new Set(['.git', 'node_modules', '__MACOSX'])
const HTML_FILE = /\.html?$/i

export const INDEX = 'index.html'

export type PublishFile = { relPath: string; body: Blob }

/**
 * Debris that should never reach the store. Dot-files are dropped wholesale so
 * a stray `.env` or `.git/config` in a dragged folder cannot be published.
 * Directories may still be dotted, which keeps `.well-known/` usable.
 */
export function shouldIgnore(relPath: string): boolean {
  const segments = relPath.split('/')
  const name = segments.at(-1)!

  if (name.startsWith('.') || IGNORED_NAMES.has(name)) return true
  return segments.slice(0, -1).some((segment) => IGNORED_DIRS.has(segment))
}

export type Prepared = {
  files: PublishFile[]
  ignored: string[]
  /** Paths that could not be made safe, e.g. traversal attempts. Surfaced, never silently dropped. */
  rejected: string[]
  /** Original name of the lone root page that was renamed to `index.html`, if any. */
  promoted: string | null
  hasIndex: boolean
  bytes: number
}

/**
 * A single dropped page has no reason to be called `index.html`, so a lone
 * root-level `.html` is renamed into place. Two candidates are ambiguous, and
 * anything nested would break the relative links inside it — both are left alone
 * for the caller to warn about.
 */
function promoteIndex(files: PublishFile[]): { files: PublishFile[]; promoted: string | null } {
  if (files.some((file) => file.relPath === INDEX)) return { files, promoted: null }

  const roots = files.filter((file) => !file.relPath.includes('/') && HTML_FILE.test(file.relPath))
  if (roots.length !== 1) return { files, promoted: null }

  const entry = roots[0]!
  return {
    files: files.map((file) => (file === entry ? { ...file, relPath: INDEX } : file)),
    promoted: entry.relPath,
  }
}

export function prepare(input: PublishFile[]): Prepared {
  const kept: PublishFile[] = []
  const ignored: string[] = []
  const rejected: string[] = []

  for (const file of input) {
    const relPath = normalizeRelPath(file.relPath)
    if (!relPath) rejected.push(file.relPath)
    else if (shouldIgnore(relPath)) ignored.push(relPath)
    else kept.push({ relPath, body: file.body })
  }

  const { files, promoted } = promoteIndex(kept)

  return {
    files,
    ignored,
    rejected,
    promoted,
    hasIndex: files.some((file) => file.relPath === INDEX),
    bytes: files.reduce((total, file) => total + file.body.size, 0),
  }
}

export async function requestName(endpoint: string, password: string): Promise<string> {
  const response = await fetch(`${endpoint}/api/name`, {
    headers: { authorization: `Bearer ${password}` },
  })
  const payload = (await response.json()) as { subdomain?: string; error?: string }
  if (!response.ok || !payload.subdomain) throw new Error(payload.error ?? 'Could not generate a name')
  return payload.subdomain
}

async function commit(
  endpoint: string,
  password: string,
  subdomain: string,
  relPaths: string[],
  force: boolean,
) {
  const response = await fetch(`${endpoint}/api/commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${password}`, 'content-type': 'application/json' },
    body: JSON.stringify({ subdomain, relPaths, force }),
  })

  const payload = (await response.json()) as { error?: string; pruned?: number }
  if (!response.ok) throw new Error(payload.error ?? `Commit failed (${response.status})`)
  return payload
}

export type PublishProgress = { done: number; total: number; relPath: string }

export type PublishOptions = {
  /** Origin of the drop service. Empty string for same-origin browser calls. */
  endpoint?: string
  password: string
  subdomain: string
  files: PublishFile[]
  /** Publish even without a root `index.html`. The site's root will 404. */
  force?: boolean
  onProgress?: (progress: PublishProgress) => void
}

export async function publishSite(options: PublishOptions) {
  const { endpoint = '', password, subdomain, files, force = false, onProgress } = options

  const invalid = validateSubdomain(subdomain)
  if (invalid) throw new Error(`Subdomain "${subdomain}" is ${invalid}`)
  if (files.length === 0) throw new Error('No files to publish')
  if (files.length > MAX_FILES_PER_SITE) {
    throw new Error(`A site may contain at most ${MAX_FILES_PER_SITE} files, got ${files.length}`)
  }
  if (!force && !files.some((file) => file.relPath === INDEX)) {
    throw new Error(`No ${INDEX} at the root. Publish anyway to serve the files without a landing page.`)
  }

  let done = 0
  for (const { relPath, body } of files) {
    await upload(siteKey(subdomain, relPath), body, {
      access: 'public',
      handleUploadUrl: `${endpoint}/api/upload`,
      headers: { authorization: `Bearer ${password}` },
      contentType: baseContentTypeFor(relPath),
      multipart: body.size > MULTIPART_THRESHOLD,
    })

    done += 1
    onProgress?.({ done, total: files.length, relPath })
  }

  const result = await commit(endpoint, password, subdomain, files.map((file) => file.relPath), force)
  return { subdomain, files: files.length, pruned: result.pruned ?? 0 }
}
