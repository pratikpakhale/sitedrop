import { shouldIgnore, type PublishFile } from './publish'

/**
 * A dropped folder or archive usually wraps everything in one directory
 * (`dist/index.html`). Returns that segment when every entry shares it, else ''.
 */
export function commonRoot(paths: string[]): string {
  if (paths.length === 0) return ''

  const firstSegments = new Set<string>()
  for (const path of paths) {
    const segments = path.split('/')
    if (segments.length < 2) return ''
    firstSegments.add(segments[0]!)
  }

  return firstSegments.size === 1 ? [...firstSegments][0]! : ''
}

/**
 * The root is derived from publishable paths only: a macOS archive carries a
 * sibling `__MACOSX/` tree that would otherwise mask the real wrapper folder.
 */
export function stripCommonRoot(files: PublishFile[]): PublishFile[] {
  const root = commonRoot(files.filter((file) => !shouldIgnore(file.relPath)).map((file) => file.relPath))
  if (!root) return files

  const prefix = `${root}/`
  return files.map((file) =>
    file.relPath.startsWith(prefix) ? { ...file, relPath: file.relPath.slice(prefix.length) } : file,
  )
}
