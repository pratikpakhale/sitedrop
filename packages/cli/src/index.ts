import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { prepare, type PublishFile } from '@sitedrop/core/prepare'
import { publishSite, requestName } from '@sitedrop/core/publish'
import { stripCommonRoot } from '@sitedrop/core/tree'
import { filesFromZip, isZip } from '@sitedrop/core/zip'
import { version } from '../package.json'

const USAGE = `sitedrop — publish static files to a subdomain

Usage
  sitedrop <path...> [options]

  A path may be a folder, a .zip, or a file; mix them freely. Folder and
  archive contents land at the site root, with a single wrapper directory
  stripped. A lone .html file is renamed to index.html automatically.

Options
  -n, --name <subdomain>  site name; omit for a random one
  -e, --endpoint <url>    drop service origin        (env: SITEDROP_ENDPOINT)
  -p, --password <pass>   shared publish secret      (env: SITEDROP_PASSWORD)
  -f, --force             publish without an index.html; the root will 404
  -h, --help
  -v, --version
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

async function collect(sources: string[]): Promise<PublishFile[]> {
  const files: PublishFile[] = []

  for (const source of sources) {
    if ((await stat(source)).isDirectory()) {
      files.push(...stripCommonRoot(await collectDirectory(source)))
    } else if (isZip(source)) {
      files.push(...filesFromZip(new Uint8Array(await readFile(source))))
    } else {
      files.push({ relPath: basename(source), body: new Blob([await readFile(source)]) })
    }
  }

  const seen = new Set<string>()
  for (const { relPath } of files) {
    if (seen.has(relPath)) throw new Error(`Sources collide at ${relPath}; publish them separately.`)
    seen.add(relPath)
  }

  return files
}

function bail(message: string): never {
  console.error(message)
  process.exit(1)
}

function parse(argv: string[]) {
  try {
    return parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        name: { type: 'string', short: 'n' },
        endpoint: { type: 'string', short: 'e' },
        password: { type: 'string', short: 'p' },
        force: { type: 'boolean', short: 'f' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    })
  } catch (cause) {
    bail(`${cause instanceof Error ? cause.message : cause}\n\n${USAGE}`)
  }
}

const { values, positionals: sources } = parse(process.argv.slice(2))

if (values.help) {
  console.log(USAGE)
  process.exit(0)
}
if (values.version) {
  console.log(version)
  process.exit(0)
}
if (sources.length === 0) bail(USAGE)

const rawEndpoint = values.endpoint ?? process.env.SITEDROP_ENDPOINT
const password = values.password ?? process.env.SITEDROP_PASSWORD

if (!rawEndpoint) bail('Missing endpoint. Pass --endpoint or set SITEDROP_ENDPOINT.')
if (!password) bail('Missing password. Pass --password or set SITEDROP_PASSWORD.')

const endpoint = rawEndpoint.replace(/\/+$/, '')

try {
  const selection = prepare(await collect(sources))

  for (const path of selection.rejected) console.warn(`  skipped (unsafe path): ${path}`)
  if (selection.files.length === 0) throw new Error('No publishable files in the given paths')

  if (selection.promoted) console.log(`Renaming ${selection.promoted} → index.html`)
  if (!selection.hasIndex && !values.force) {
    throw new Error('No index.html at the root. Re-run with --force to publish without a landing page.')
  }
  if (!selection.hasIndex) console.warn('Warning: no index.html — the site root will return 404.')

  const subdomain = values.name ?? (await requestName(endpoint, password))
  console.log(`Publishing ${selection.files.length} files → ${subdomain}`)

  const result = await publishSite({
    endpoint,
    password,
    subdomain,
    force: values.force,
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
