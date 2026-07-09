import { normalizeRelPath } from './keys'

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
