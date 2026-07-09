import { assertAuthorized, errorResponse } from '@/lib/auth'
import { siteExists } from '@/lib/blob'
import { sitePrefix } from '@/lib/keys'
import { randomSubdomain } from '@/lib/names'

export const runtime = 'nodejs'

const MAX_ATTEMPTS = 5

export async function GET(request: Request) {
  try {
    assertAuthorized(request)

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const subdomain = randomSubdomain()
      if (!(await siteExists(sitePrefix(subdomain)))) return Response.json({ subdomain })
    }

    throw new Error('Could not find an unused name; try again')
  } catch (error) {
    return errorResponse(error)
  }
}
