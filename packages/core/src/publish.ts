import { upload } from '@vercel/blob/client'
import { MAX_FILES_PER_SITE } from './config'
import { siteKey } from './keys'
import { baseContentTypeFor } from './mime'
import { INDEX, type PublishFile } from './prepare'
import { validateSubdomain } from './subdomain'

const MULTIPART_THRESHOLD = 5 * 1024 * 1024

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

export type PublishResult = { subdomain: string; files: number; pruned: number }

export async function publishSite(options: PublishOptions): Promise<PublishResult> {
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
