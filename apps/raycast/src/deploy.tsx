import {
  Action,
  ActionPanel,
  Detail,
  Form,
  getSelectedFinderItems,
  Icon,
  popToRoot,
} from '@raycast/api'
import { useEffect, useState } from 'react'
import { deploy } from './lib/deploy'

type Props = { arguments: { path?: string; name?: string } }
type Values = { paths: string[]; name: string; force: boolean }

async function finderSelection(): Promise<string[]> {
  try {
    return (await getSelectedFinderItems()).map((item) => item.path)
  } catch {
    return []
  }
}

export default function Command(props: Props) {
  const path = props.arguments.path?.trim()
  const name = props.arguments.name?.trim() || undefined

  const [picking, setPicking] = useState(false)
  const [pathsError, setPathsError] = useState<string | undefined>()

  useEffect(() => {
    async function start() {
      const sources = path ? [path] : await finderSelection()
      if (sources.length === 0) {
        setPicking(true)
        return
      }
      await deploy(sources, { name })
      await popToRoot()
    }
    start()
  }, [])

  if (!picking) return <Detail isLoading markdown="" />

  async function submit(values: Values) {
    if (values.paths.length === 0) {
      setPathsError('Pick something to publish')
      return
    }

    await popToRoot()
    await deploy(values.paths, { name: values.name.trim() || undefined, force: values.force })
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Deploy" icon={Icon.Upload} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.FilePicker
        id="paths"
        title="Files"
        allowMultipleSelection
        canChooseDirectories
        canChooseFiles
        error={pathsError}
        onChange={() => setPathsError(undefined)}
      />
      <Form.TextField id="name" title="Name" defaultValue={name} placeholder="random subdomain" />
      <Form.Checkbox id="force" label="Publish without an index.html" />
    </Form>
  )
}
