import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join, sep } from 'node:path'
import type { PublishFile } from './prepare'
import { stripCommonRoot } from './tree'
import { filesFromZip, isZip } from './zip'

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

/** A source may be a directory, a `.zip`, or a lone file; contents land at the site root. */
export async function collect(sources: string[]): Promise<PublishFile[]> {
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
