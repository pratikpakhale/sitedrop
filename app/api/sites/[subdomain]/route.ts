import { assertAuthorized, errorResponse } from '@/lib/auth'
import { deletePathnames, listAll } from '@/lib/blob'
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
