import { unzipSync } from 'fflate'
import type { PublishFile } from './publish'
import { stripCommonRoot } from './tree'

export function isZip(name: string): boolean {
  return name.toLowerCase().endsWith('.zip')
}

export function filesFromZip(bytes: Uint8Array): PublishFile[] {
  const entries = unzipSync(bytes)

  const files = Object.keys(entries)
    .filter((path) => !path.endsWith('/'))
    .map((path) => ({ relPath: path, body: new Blob([entries[path]!]) }))

  return stripCommonRoot(files)
}
