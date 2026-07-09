#!/usr/bin/env bun
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { prepare, publishSite, requestName, type PublishFile } from '../lib/publish'
import { stripCommonRoot } from '../lib/tree'
import { filesFromZip, isZip } from '../lib/zip'

const USAGE = `
  bun run drop <folder|zip> [subdomain] [--force]

  Omit the subdomain and a random one is generated.
  A lone .html file at the root is renamed to index.html automatically.
  --force publishes even when there is no index.html; the root will 404.

  Environment (bun reads .env.local automatically):
    DROP_ENDPOINT   https://site.pakhale.com
    DROP_PASSWORD   the shared publish secret
`

async function collectDirectory(root: string): Promise<PublishFile[]> {
  const entries = await readdir(root, { recursive: true })
  const files: PublishFile[] = []

  for (const entry of entries) {
    const absolute = join(root, entry)
    if (!(await stat(absolute)).isFile()) continue

    files.push({
      relPath: entry.split(sep).join('/'),
      body: new Blob([await readFile(absolute)]),
    })
  }

  return files
}

async function collect(source: string): Promise<PublishFile[]> {
  if (isZip(source)) return filesFromZip(new Uint8Array(await readFile(source)))
  if (!(await stat(source)).isDirectory()) throw new Error(`${source} is neither a folder nor a .zip`)
  return stripCommonRoot(await collectDirectory(source))
}

const argv = process.argv.slice(2)
const force = argv.includes('--force') || argv.includes('-f')
const [source, requested] = argv.filter((arg) => !arg.startsWith('-'))

const rawEndpoint = process.env.DROP_ENDPOINT
const password = process.env.DROP_PASSWORD

if (!source) {
  console.error(USAGE)
  process.exit(1)
}
if (!rawEndpoint || !password) {
  console.error('DROP_ENDPOINT and DROP_PASSWORD must both be set.')
  process.exit(1)
}

const endpoint = rawEndpoint.replace(/\/+$/, '')

try {
  const selection = prepare(await collect(source))

  for (const path of selection.rejected) console.warn(`  skipped (unsafe path): ${path}`)
  if (selection.files.length === 0) throw new Error(`No publishable files in ${source}`)

  if (selection.promoted) console.log(`Renaming ${selection.promoted} → index.html`)
  if (!selection.hasIndex && !force) {
    throw new Error('No index.html at the root. Re-run with --force to publish without a landing page.')
  }
  if (!selection.hasIndex) console.warn('Warning: no index.html — the site root will return 404.')

  const subdomain = requested ?? (await requestName(endpoint, password))
  console.log(`Publishing ${selection.files.length} files from ${source} → ${subdomain}`)

  const result = await publishSite({
    endpoint,
    password,
    subdomain,
    force,
    files: selection.files,
    onProgress: ({ done, total, relPath }) => {
      console.log(`  [${String(done).padStart(String(total).length)}/${total}] ${relPath}`)
    },
  })

  console.log(`\nLive at https://${subdomain}.${new URL(endpoint).host}`)
  if (result.pruned > 0) console.log(`Pruned ${result.pruned} stale file(s).`)
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
