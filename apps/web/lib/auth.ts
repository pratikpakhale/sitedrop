import { createHash, timingSafeEqual } from 'node:crypto'

export class Unauthorized extends Error {
  constructor(message = 'Invalid or missing password') {
    super(message)
    this.name = 'Unauthorized'
  }
}

export class NotConfigured extends Error {
  constructor(message = 'DROP_PASSWORD is not set on the server') {
    super(message)
    this.name = 'NotConfigured'
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

/** Throws Unauthorized/NotConfigured rather than returning false, so a caller cannot forget to check. */
export function assertAuthorized(request: Request): void {
  const expected = process.env.DROP_PASSWORD
  if (!expected) throw new NotConfigured()

  const supplied = bearerToken(request)
  if (!supplied) throw new Unauthorized()

  if (!timingSafeEqual(digest(supplied), digest(expected))) throw new Unauthorized()
}

export function errorResponse(error: unknown): Response {
  if (error instanceof NotConfigured) {
    return Response.json({ error: error.message }, { status: 503 })
  }
  if (error instanceof Unauthorized) {
    return Response.json({ error: error.message }, { status: 401 })
  }
  const message = error instanceof Error ? error.message : 'Unexpected error'
  return Response.json({ error: message }, { status: 400 })
}
