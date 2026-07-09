'use client'

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { filesFromDataTransfer, filesFromFileList } from '@/lib/browser-files'
import { ROOT_DOMAIN } from '@/lib/config'
import { partition, publishSite, requestName, type Partitioned } from '@/lib/publish'
import type { SiteSummary } from '@/lib/types'

type Status = { tone: 'idle' | 'error' | 'ok'; message: string }

const IS_LOCAL = ROOT_DOMAIN.startsWith('localhost')
const IDLE: Status = { tone: 'idle', message: '' }

function siteUrl(subdomain: string): string {
  return `${IS_LOCAL ? 'http' : 'https'}://${subdomain}.${ROOT_DOMAIN}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function describe(selection: Partitioned): string {
  const parts = [`${selection.publishable.length} files`]
  if (selection.ignored.length > 0) parts.push(`${selection.ignored.length} ignored`)
  if (selection.rejected.length > 0) parts.push(`${selection.rejected.length} unsupported`)
  return parts.join(' · ')
}

export default function Home() {
  const folderInput = useRef<HTMLInputElement>(null)
  const zipInput = useRef<HTMLInputElement>(null)

  const [password, setPassword] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [selection, setSelection] = useState<Partitioned | null>(null)
  const [status, setStatus] = useState<Status>(IDLE)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sites, setSites] = useState<SiteSummary[] | null>(null)

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '')
    folderInput.current?.setAttribute('directory', '')
  }, [])

  function fail(error: unknown) {
    setStatus({ tone: 'error', message: error instanceof Error ? error.message : 'Something went wrong' })
  }

  async function loadSites(secret: string) {
    const response = await fetch('/api/sites', { headers: { authorization: `Bearer ${secret}` } })
    const payload = (await response.json()) as { sites?: SiteSummary[]; error?: string }
    if (!response.ok) throw new Error(payload.error ?? 'Could not load sites')
    setSites(payload.sites ?? [])
  }

  function accept(files: Awaited<ReturnType<typeof filesFromFileList>>) {
    const next = partition(files)
    setSelection(next)
    setStatus(next.publishable.length === 0 ? { tone: 'error', message: 'Nothing publishable in there' } : IDLE)
  }

  async function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (busy) return

    try {
      accept(await filesFromDataTransfer(event.dataTransfer))
    } catch (error) {
      fail(error)
    }
  }

  async function onPick(input: HTMLInputElement) {
    if (!input.files?.length) return
    try {
      accept(await filesFromFileList(input.files))
    } catch (error) {
      fail(error)
    }
  }

  async function generateName() {
    try {
      setSubdomain(await requestName('', password))
    } catch (error) {
      fail(error)
    }
  }

  async function onPublish(event: FormEvent) {
    event.preventDefault()
    if (!selection?.publishable.length || busy) return

    setBusy(true)
    setStatus({ tone: 'idle', message: 'Preparing…' })

    try {
      const target = subdomain || (await requestName('', password))
      setSubdomain(target)

      const result = await publishSite({
        password,
        subdomain: target,
        files: selection.publishable,
        onProgress: ({ done, total, relPath }) =>
          setStatus({ tone: 'idle', message: `Uploading ${done}/${total} — ${relPath}` }),
      })

      setStatus({ tone: 'ok', message: `Live at ${siteUrl(target)} — ${result.pruned} pruned` })
      await loadSites(password).catch(() => undefined)
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(target: string) {
    if (!confirm(`Delete ${target}.${ROOT_DOMAIN} and all of its files?`)) return

    try {
      const response = await fetch(`/api/sites/${target}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${password}` },
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Delete failed')
      await loadSites(password)
    } catch (error) {
      fail(error)
    }
  }

  const canPublish = !busy && !!password && !!selection?.publishable.length

  return (
    <main>
      <h1>site drop</h1>
      <p className="sub">Drop a folder or a .zip. It goes live on a subdomain of {ROOT_DOMAIN}.</p>

      <form className="panel" onSubmit={onPublish}>
        <div
          className={`dropzone ${dragging ? 'dragging' : ''} ${selection ? 'filled' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {selection ? (
            <>
              <strong>{describe(selection)}</strong>
              {selection.rejected.length > 0 && (
                <span className="rejects">Unsupported: {selection.rejected.slice(0, 4).join(', ')}</span>
              )}
            </>
          ) : (
            <>
              <strong>Drop a folder or .zip here</strong>
              <span>must contain an index.html at its root</span>
            </>
          )}

          <div className="picks">
            <button type="button" className="ghost" onClick={() => folderInput.current?.click()}>
              Choose folder
            </button>
            <button type="button" className="ghost" onClick={() => zipInput.current?.click()}>
              Choose .zip
            </button>
          </div>
        </div>

        <input ref={folderInput} type="file" multiple hidden onChange={(e) => onPick(e.currentTarget)} />
        <input ref={zipInput} type="file" accept=".zip" hidden onChange={(e) => onPick(e.currentTarget)} />

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="subdomain">Subdomain</label>
          <div className="row">
            <input
              id="subdomain"
              type="text"
              value={subdomain}
              placeholder="leave blank for a random name"
              spellCheck={false}
              onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
            />
            <button type="button" className="ghost" disabled={!password} onClick={generateName}>
              Random
            </button>
          </div>
          {subdomain && <div className="host">{siteUrl(subdomain)}</div>}
        </div>

        <button className="primary" type="submit" disabled={!canPublish}>
          {busy ? 'Publishing…' : 'Publish'}
        </button>

        {status.message && (
          <div className={`status ${status.tone === 'idle' ? '' : status.tone}`}>{status.message}</div>
        )}
      </form>

      <section className="sites">
        <div className="sites-head">
          <h2>Sites</h2>
          <button className="ghost" type="button" disabled={!password} onClick={() => loadSites(password).catch(fail)}>
            Refresh
          </button>
        </div>

        {sites === null && <div className="empty">Enter the password, then refresh.</div>}
        {sites?.length === 0 && <div className="empty">Nothing published yet.</div>}

        {sites?.map((site) => (
          <div className="site-row" key={site.subdomain}>
            <div>
              <a href={siteUrl(site.subdomain)} target="_blank" rel="noreferrer">
                {site.subdomain}.{ROOT_DOMAIN}
              </a>
              <div className="site-meta">
                {site.files} files · {formatBytes(site.bytes)} · {new Date(site.updatedAt).toLocaleString()}
              </div>
            </div>
            <button className="ghost" type="button" onClick={() => onDelete(site.subdomain)}>
              Delete
            </button>
          </div>
        ))}
      </section>
    </main>
  )
}
