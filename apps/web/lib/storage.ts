import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { encodeKey, parseSiteKey, siteKey, sitePrefix } from '@sitedrop/core/keys'

const COPY_CONCURRENCY = 8
const DELETE_BATCH = 1000
const UPLOAD_URL_TTL_SECONDS = 60 * 60
const READ_URL_TTL_SECONDS = 60

export type StoredObject = { key: string; size: number; lastModified: Date }

type Store = { client: S3Client; bucket: string }

let store: Store | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set on the server`)
  return value
}

/** Built on first use so `next build` does not need R2 credentials. */
function r2(): Store {
  store ??= {
    bucket: requireEnv('R2_BUCKET'),
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
      },
      // The SDK's default flexible checksums would be baked into presigned PUT
      // URLs as the checksum of an empty body.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  }
  return store
}

export async function listAll(prefix: string): Promise<StoredObject[]> {
  const { client, bucket } = r2()
  const all: StoredObject[] = []
  let token: string | undefined

  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    )
    for (const object of page.Contents ?? []) {
      if (!object.Key) continue
      all.push({ key: object.Key, size: object.Size ?? 0, lastModified: object.LastModified ?? new Date(0) })
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)

  return all
}

export async function siteExists(prefix: string): Promise<boolean> {
  const { client, bucket } = r2()
  const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1 }))
  return (page.KeyCount ?? 0) > 0
}

export async function deleteKeys(keys: string[]): Promise<void> {
  const { client, bucket } = r2()

  for (let i = 0; i < keys.length; i += DELETE_BATCH) {
    const batch = keys.slice(i, i + DELETE_BATCH)
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    )
    const failed = result.Errors ?? []
    if (failed.length > 0) {
      throw new Error(`Could not delete ${failed.length} file(s): ${failed[0]!.Key} (${failed[0]!.Message})`)
    }
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
 * R2 has no directory move, so every key is copied before any source is
 * deleted. A mid-flight error leaves the site whole at its old name, possibly
 * with partial copies under the new one, rather than losing files.
 */
export async function renameSite(from: string, to: string): Promise<number> {
  const { client, bucket } = r2()
  const objects = (await listAll(sitePrefix(from))).filter((object) => parseSiteKey(object.key))

  await pool(objects, COPY_CONCURRENCY, async (object) => {
    const { relPath } = parseSiteKey(object.key)!
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${encodeKey(object.key)}`,
        Key: siteKey(to, relPath),
      }),
    )
  })

  await deleteKeys(objects.map((object) => object.key))
  return objects.length
}

/**
 * The content type and exact length are signed into the URL, so the holder can
 * write only that one key, with that type, at the size it declared.
 */
export function presignUpload(key: string, contentType: string, size: number): Promise<string> {
  const { client, bucket } = r2()
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS, signableHeaders: new Set(['content-type', 'content-length']) },
  )
}

/** Signing is local, so a read costs one round-trip to R2 and no SDK call. */
export function presignRead(key: string): Promise<string> {
  const { client, bucket } = r2()
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: READ_URL_TTL_SECONDS,
  })
}
