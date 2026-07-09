import { assertAuthorized, errorResponse } from '@/lib/auth'
import { deletePathnames, listAll, renameSite, siteExists } from '@/lib/blob'
import { sitePrefix } from '@/lib/keys'
import { validateSubdomain } from '@/lib/subdomain'

export const runtime = 'nodejs'

type Context = { params: Promise<{ subdomain: string }> }

export async function DELETE(request: Request, context: Context) {
  try {
    assertAuthorized(request)

    const { subdomain } = await context.params
    const invalid = validateSubdomain(subdomain)
    if (invalid) throw new Error(`Subdomain "${subdomain}" is ${invalid}`)

    const blobs = await listAll(sitePrefix(subdomain))
    if (blobs.length === 0) return Response.json({ error: 'No such site' }, { status: 404 })

    await deletePathnames(blobs.map((blob) => blob.pathname))
    return Response.json({ subdomain, deleted: blobs.length })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    assertAuthorized(request)

    const { subdomain } = await context.params
    const invalidFrom = validateSubdomain(subdomain)
    if (invalidFrom) throw new Error(`Subdomain "${subdomain}" is ${invalidFrom}`)

    const { to } = (await request.json()) as { to?: unknown }
    if (typeof to !== 'string') throw new Error('to is required')
    if (to === subdomain) return Response.json({ subdomain, moved: 0 })

    const invalidTo = validateSubdomain(to)
    if (invalidTo) throw new Error(`Subdomain "${to}" is ${invalidTo}`)

    if (!(await siteExists(sitePrefix(subdomain)))) {
      return Response.json({ error: 'No such site' }, { status: 404 })
    }
    if (await siteExists(sitePrefix(to))) throw new Error(`Subdomain "${to}" is already taken`)

    const moved = await renameSite(subdomain, to)
    return Response.json({ subdomain: to, moved })
  } catch (error) {
    return errorResponse(error)
  }
}
