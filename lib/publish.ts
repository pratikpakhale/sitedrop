import { upload } from '@vercel/blob/client'
import { MAX_FILES_PER_SITE } from './config'
import { normalizeRelPath, siteKey } from './keys'
import { baseContentTypeFor, isAllowedFile } from './mime'
import { validateSubdomain } from './subdomain'

const MULTIPART_THRESHOLD = 5 * 1024 * 1024

const IGNORED_NAMES = new Set(['Thumbs.db', 'desktop.ini'])
const IGNORED_DIRS = new Set(['.git', 'node_modules', '__MACOSX'])

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

export type Partitioned = {
  publishable: PublishFile[]
  ignored: string[]
  /** Real files whose extension is not on the allowlist. Surfaced, never silently dropped. */
  rejected: string[]
}

export function partition(files: PublishFile[]): Partitioned {
  const result: Partitioned = { publishable: [], ignored: [], rejected: [] }

  for (const file of files) {
    const relPath = normalizeRelPath(file.relPath)
    if (!relPath) {
      result.rejected.push(file.relPath)
      continue
    }
    if (shouldIgnore(relPath)) {
      result.ignored.push(relPath)
      continue
    }
    if (!isAllowedFile(relPath)) {
      result.rejected.push(relPath)
      continue
    }
    result.publishable.push({ relPath, body: file.body })
  }

  return result
}

export async function requestName(endpoint: string, password: string): Promise<string> {
  const response = await fetch(`${endpoint}/api/name`, {
    headers: { authorization: `Bearer ${password}` },
  })
  const payload = (await response.json()) as { subdomain?: string; error?: string }
  if (!response.ok || !payload.subdomain) throw new Error(payload.error ?? 'Could not generate a name')
  return payload.subdomain
}

async function commit(endpoint: string, password: string, subdomain: string, relPaths: string[]) {
  const response = await fetch(`${endpoint}/api/commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${password}`, 'content-type': 'application/json' },
    body: JSON.stringify({ subdomain, relPaths }),
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
  onProgress?: (progress: PublishProgress) => void
}

export async function publishSite(options: PublishOptions) {
  const { endpoint = '', password, subdomain, files, onProgress } = options

  const invalid = validateSubdomain(subdomain)
  if (invalid) throw new Error(`Subdomain "${subdomain}" is ${invalid}`)
  if (files.length === 0) throw new Error('No files to publish')
  if (files.length > MAX_FILES_PER_SITE) {
    throw new Error(`A site may contain at most ${MAX_FILES_PER_SITE} files, got ${files.length}`)
  }
  if (!files.some((file) => file.relPath === 'index.html')) {
    throw new Error('A site must include an index.html at its root')
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

  const result = await commit(endpoint, password, subdomain, files.map((file) => file.relPath))
  return { subdomain, files: files.length, pruned: result.pruned ?? 0 }
}
