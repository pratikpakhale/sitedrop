import { Action, ActionPanel, Form, Icon, popToRoot } from '@raycast/api'
import { useState } from 'react'
import { deploy } from './lib/deploy'

type Values = { paths: string[]; name: string; force: boolean }

export default function Command() {
  const [pathsError, setPathsError] = useState<string | undefined>()

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
      <Form.TextField id="name" title="Name" placeholder="random subdomain" />
      <Form.Checkbox id="force" label="Publish without an index.html" />
    </Form>
  )
}
