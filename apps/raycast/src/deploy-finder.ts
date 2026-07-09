import { getSelectedFinderItems, launchCommand, LaunchType, showToast, Toast } from '@raycast/api'
import { deploy } from './lib/deploy'

type Props = { arguments: { name?: string } }

async function selection(): Promise<string[]> {
  try {
    return (await getSelectedFinderItems()).map((item) => item.path)
  } catch {
    return []
  }
}

export default async function command(props: Props) {
  const paths = await selection()

  if (paths.length === 0) {
    const toast = await showToast({
      style: Toast.Style.Failure,
      title: 'Nothing selected in Finder',
    })
    toast.primaryAction = {
      title: 'Pick Files Instead',
      onAction: () => launchCommand({ name: 'deploy', type: LaunchType.UserInitiated }),
    }
    return
  }

  await deploy(paths, { name: props.arguments.name?.trim() || undefined })
}
