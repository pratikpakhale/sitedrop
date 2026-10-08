import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Clipboard, getPreferenceValues, open, showHUD, showToast, Toast } from '@raycast/api'
import { collect } from '@sitedrop/core/disk'
import { prepare } from '@sitedrop/core/prepare'
import { publishSite, requestName } from '@sitedrop/core/publish'

type Prefs = { endpoint: string; password: string; openInBrowser: boolean }

type DeployOptions = { name?: string; force?: boolean }

class MissingIndex extends Error {}

/** Raycast 2 hands Finder items over as `file://` URLs rather than paths. */
function toPath(source: string): string {
  if (source.startsWith('file://')) return fileURLToPath(source)
  return source === '~' || source.startsWith('~/') ? join(homedir(), source.slice(1)) : source
}

export async function deploy(paths: string[], options: DeployOptions = {}): Promise<void> {
  const { endpoint: rawEndpoint, password, openInBrowser } = getPreferenceValues<Prefs>()
  const endpoint = rawEndpoint.replace(/\/+$/, '')

  const toast = await showToast({ style: Toast.Style.Animated, title: 'Reading files' })

  try {
    const selection = prepare(await collect(paths.map(toPath)))
    if (selection.files.length === 0) throw new Error('Nothing publishable in that selection')
    if (!selection.hasIndex && !options.force) throw new MissingIndex()

    const subdomain = options.name || (await requestName(endpoint, password))

    toast.title = `Uploading 0/${selection.files.length}`
    toast.message = subdomain

    const result = await publishSite({
      endpoint,
      password,
      subdomain,
      files: selection.files,
      force: options.force,
      onProgress: ({ done, total }) => {
        toast.title = `Uploading ${done}/${total}`
      },
    })

    const url = `https://${subdomain}.${new URL(endpoint).host}`
    await Clipboard.copy(url)
    if (openInBrowser) await open(url)

    await toast.hide()
    const pruned = result.pruned > 0 ? `, pruned ${result.pruned}` : ''
    await showHUD(`Live at ${subdomain} — link copied${pruned}`)
  } catch (error) {
    if (!(error instanceof MissingIndex)) {
      toast.style = Toast.Style.Failure
      toast.title = 'Deploy failed'
      toast.message = error instanceof Error ? error.message : String(error)
      return
    }

    toast.style = Toast.Style.Failure
    toast.title = 'No index.html at the root'
    toast.message = 'The site root will 404'

    return new Promise((resolve) => {
      toast.primaryAction = {
        title: 'Publish Anyway',
        onAction: () => resolve(deploy(paths, { ...options, force: true })),
      }
    })
  }
}
