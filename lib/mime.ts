const BASE_TYPES: Record<string, string> = {
  avif: 'image/avif',
  bmp: 'image/bmp',
  css: 'text/css',
  csv: 'text/csv',
  eot: 'application/vnd.ms-fontobject',
  gif: 'image/gif',
  htm: 'text/html',
  html: 'text/html',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript',
  json: 'application/json',
  map: 'application/json',
  md: 'text/markdown',
  mjs: 'text/javascript',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  ogg: 'audio/ogg',
  otf: 'font/otf',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  txt: 'text/plain',
  wasm: 'application/wasm',
  wav: 'audio/wav',
  webm: 'video/webm',
  webmanifest: 'application/manifest+json',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  xml: 'application/xml',
}

const FALLBACK_TYPE = 'application/octet-stream'

const NEEDS_CHARSET = new Set([
  'css',
  'csv',
  'htm',
  'html',
  'js',
  'json',
  'map',
  'md',
  'mjs',
  'svg',
  'txt',
  'webmanifest',
  'xml',
])

export function extensionOf(pathname: string): string | null {
  const base = pathname.split('/').pop() ?? ''
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return null
  return base.slice(dot + 1).toLowerCase()
}

/**
 * Every file type is publishable. Unknown extensions fall back to
 * `application/octet-stream`, which the browser downloads rather than renders —
 * combined with `nosniff` on the serving route, an unrecognised upload can never
 * be coerced into executing as markup.
 */
export function isKnownType(pathname: string): boolean {
  const ext = extensionOf(pathname)
  return ext !== null && ext in BASE_TYPES
}

/** Stored on the blob and pinned via `allowedContentTypes`, so it must match the client exactly. */
export function baseContentTypeFor(pathname: string): string {
  const ext = extensionOf(pathname)
  return (ext && BASE_TYPES[ext]) || FALLBACK_TYPE
}

/** Sent to browsers. Always derived from the extension, never from the stored blob metadata. */
export function contentTypeFor(pathname: string): string {
  const ext = extensionOf(pathname)
  const base = baseContentTypeFor(pathname)
  return ext && NEEDS_CHARSET.has(ext) ? `${base}; charset=utf-8` : base
}

export function looksLikeFile(segment: string): boolean {
  return extensionOf(segment) !== null
}

export const KNOWN_EXTENSIONS = Object.keys(BASE_TYPES).sort()
