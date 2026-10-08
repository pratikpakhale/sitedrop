import { MAX_FILES_PER_SITE } from './config'
import { INDEX, type PublishFile } from './prepare'
import { validateSubdomain } from './subdomain'

/** Body of `POST /api/upload`. */
export type UploadRequest = { subdomain: string; files: { relPath: string; size: number }[] }

/** A presigned PUT for one file; `headers` are signed into `url` and must be sent verbatim. */
export type UploadTarget = { relPath: string; url: string; headers: Record<string, string> }

export async function requestName(endpoint: string, password: string): Promise<string> {
  const response = await fetch(`${endpoint}/api/name`, {
    headers: { authorization: `Bearer ${password}` },
  })
  const payload = (await response.json()) as { subdomain?: string; error?: string }
  if (!response.ok || !payload.subdomain) throw new Error(payload.error ?? 'Could not generate a name')
  return payload.subdomain
}

async function requestUploads(
  endpoint: string,
  password: string,
  subdomain: string,
  files: PublishFile[],
): Promise<UploadTarget[]> {
  const body: UploadRequest = {
    subdomain,
    files: files.map(({ relPath, body }) => ({ relPath, size: body.size })),
  }
  const response = await fetch(`${endpoint}/api/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${password}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  const payload = (await response.json()) as { uploads?: UploadTarget[]; error?: string }
  if (!response.ok || !payload.uploads) throw new Error(payload.error ?? `Upload failed (${response.status})`)
  return payload.uploads
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

  const targets = await requestUploads(endpoint, password, subdomain, files)

  for (const [i, { relPath, body }] of files.entries()) {
    const { url, headers } = targets[i]!
    const response = await fetch(url, { method: 'PUT', headers, body })
    if (!response.ok) throw new Error(`Uploading ${relPath} failed (${response.status})`)

    onProgress?.({ done: i + 1, total: files.length, relPath })
  }

  const result = await commit(endpoint, password, subdomain, files.map((file) => file.relPath), force)
  return { subdomain, files: files.length, pruned: result.pruned ?? 0 }
}
