'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { filesFromDataTransfer, filesFromFileList } from '@/lib/browser-files'
import { ROOT_DOMAIN } from '@/lib/config'
import { prepare, publishSite, requestName, type Prepared, type PublishFile } from '@/lib/publish'
import { usePassword } from '@/lib/use-password'
import { Archive, Check, External, Folder, LogoMark, Shuffle, Wand, Warning, X } from './icons'
import { Alert, CopyLink, formatBytes, Gate, Header, plural, siteUrl } from './ui'

type Progress = { done: number; total: number; relPath: string }
type Result = { subdomain: string; files: number; pruned: number }

export default function Drop() {
  const { password, restoring, unlock, lock } = usePassword()
  const folderInput = useRef<HTMLInputElement>(null)
  const zipInput = useRef<HTMLInputElement>(null)

  const [subdomain, setSubdomain] = useState('')
  const [selection, setSelection] = useState<Prepared | null>(null)
  const [allowNoIndex, setAllowNoIndex] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const busy = progress !== null

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '')
    folderInput.current?.setAttribute('directory', '')
  }, [password])

  function fail(cause: unknown) {
    setError(cause instanceof Error ? cause.message : 'Something went wrong')
  }

  function accept(files: PublishFile[]) {
    const next = prepare(files)
    setSelection(next)
    setAllowNoIndex(false)
    setResult(null)
    setError(next.files.length === 0 ? 'Nothing publishable in there' : '')
  }

  async function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (busy) return

    try {
      accept(await filesFromDataTransfer(event.dataTransfer))
    } catch (cause) {
      fail(cause)
    }
  }

  async function onPick(input: HTMLInputElement) {
    if (!input.files?.length) return
    try {
      accept(await filesFromFileList(input.files))
    } catch (cause) {
      fail(cause)
    }
  }

  async function onPublish(event: FormEvent) {
    event.preventDefault()
    if (!password || !selection?.files.length || busy) return

    const force = !selection.hasIndex
    setError('')
    setResult(null)
    setProgress({ done: 0, total: selection.files.length, relPath: '' })

    try {
      const target = subdomain || (await requestName('', password))

      const published = await publishSite({
        password,
        force,
        subdomain: target,
        files: selection.files,
        onProgress: setProgress,
      })

      setSubdomain('')
      setSelection(null)
      setResult(published)
    } catch (cause) {
      fail(cause)
    } finally {
      setProgress(null)
    }
  }

  if (restoring) return <main />
  if (!password) return <Gate onUnlock={unlock} />

  const blocked = !!selection && !selection.hasIndex && !allowNoIndex
  const canPublish = !busy && !!selection?.files.length && !blocked

  const label = progress
    ? `Uploading ${progress.done}/${progress.total}`
    : selection?.promoted
      ? 'Rename & publish'
      : selection && !selection.hasIndex
        ? 'Publish anyway'
        : 'Publish'

  return (
    <main>
      <Header subtitle={`Drop a folder or a .zip. It goes live on ${ROOT_DOMAIN}.`} onLock={lock} />

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
          <div className="pulse">{selection ? <Check size={20} /> : <Folder size={20} />}</div>

          {selection ? (
            <>
              <strong>{plural(selection.files.length, 'file')}</strong>
              <span className="hint">{formatBytes(selection.bytes)} ready to publish</span>
            </>
          ) : (
            <>
              <strong>Drop a folder or .zip here</strong>
              <span className="hint">any file type · a lone .html becomes your index</span>
            </>
          )}

          <div className="picks">
            <button type="button" className="ghost" onClick={() => folderInput.current?.click()}>
              <Folder size={14} />
              Folder
            </button>
            <button type="button" className="ghost" onClick={() => zipInput.current?.click()}>
              <Archive size={14} />
              Zip
            </button>
            {selection && (
              <button type="button" className="ghost" onClick={() => setSelection(null)}>
                <X size={14} />
                Clear
              </button>
            )}
          </div>
        </div>

        <input ref={folderInput} type="file" multiple hidden onChange={(e) => onPick(e.currentTarget)} />
        <input ref={zipInput} type="file" accept=".zip" hidden onChange={(e) => onPick(e.currentTarget)} />

        {selection && (selection.promoted || selection.ignored.length > 0 || selection.rejected.length > 0) && (
          <div className="notes">
            {selection.promoted && (
              <p className="note accent">
                <Wand size={14} />
                <span>
                  <code>{selection.promoted}</code> will be renamed to <code>index.html</code>
                </span>
              </p>
            )}
            {selection.ignored.length > 0 && (
              <p className="note">
                <X size={14} />
                {plural(selection.ignored.length, 'dot-file')} and build artefact(s) ignored
              </p>
            )}
            {selection.rejected.map((path) => (
              <p className="note warn" key={path}>
                <Warning size={14} />
                <span>
                  Skipped unsafe path: <code>{path}</code>
                </span>
              </p>
            ))}
          </div>
        )}

        {selection && !selection.hasIndex && (
          <label className="check">
            <input
              type="checkbox"
              checked={allowNoIndex}
              onChange={(event) => setAllowNoIndex(event.target.checked)}
            />
            <span>
              No <code>index.html</code> at the root, so the site root will return 404. Publish anyway.
            </span>
          </label>
        )}

        <div className="field">
          <label htmlFor="subdomain">Subdomain</label>
          <div className="combo">
            <input
              id="subdomain"
              type="text"
              value={subdomain}
              placeholder="random name"
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
            />
            <span className="suffix">.{ROOT_DOMAIN}</span>
            <button
              type="button"
              className="icon-btn"
              title="Generate a random name"
              disabled={busy}
              onClick={() => requestName('', password).then(setSubdomain).catch(fail)}
            >
              <Shuffle size={15} />
            </button>
          </div>
        </div>

        <button className="primary" type="submit" disabled={!canPublish}>
          {!busy && (selection?.promoted ? <Wand size={16} /> : <LogoMark size={16} />)}
          {label}
        </button>

        {progress && (
          <div className="progress">
            <div className="track">
              <div className="fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <div className="progress-label">
              <span>{progress.relPath || 'preparing…'}</span>
              <span>
                {progress.done}/{progress.total}
              </span>
            </div>
          </div>
        )}

        {error && <Alert>{error}</Alert>}

        {result && (
          <div className="result">
            <div className="grow">
              <a href={siteUrl(result.subdomain)} target="_blank" rel="noreferrer">
                {result.subdomain}.{ROOT_DOMAIN}
              </a>
              <div className="meta">
                {plural(result.files, 'file')}
                {result.pruned > 0 && ` · ${plural(result.pruned, 'stale file')} pruned`} ·{' '}
                <Link href="/sites">manage</Link>
              </div>
            </div>
            <CopyLink url={siteUrl(result.subdomain)} />
            <a
              className="icon-btn"
              href={siteUrl(result.subdomain)}
              target="_blank"
              rel="noreferrer"
              title="Open site"
            >
              <External />
            </a>
          </div>
        )}
      </form>
    </main>
  )
}
