'use client'

import Link from 'next/link'
import { useCallback, useRef, useState, type FormEvent } from 'react'
import { Alert } from '@/components/alert'
import { CopyLink } from '@/components/copy-link'
import { Gate } from '@/components/gate'
import { Header } from '@/components/header'
import { Archive, Check, External, Folder, Shuffle, Upload, Wand, Warning, X } from '@/components/icons'
import { filesFromDataTransfer, filesFromFileList } from '@/lib/browser-files'
import { ROOT_DOMAIN } from '@/lib/config'
import { formatBytes, plural, siteUrl } from '@/lib/format'
import { prepare, type Prepared, type PublishFile } from '@sitedrop/core/prepare'
import { publishSite, requestName, type PublishProgress, type PublishResult } from '@sitedrop/core/publish'
import { usePassword } from '@/lib/use-password'
import { useWindowDrop } from '@/lib/use-window-drop'

export default function Drop() {
  const { password, restoring, unlock, lock } = usePassword()
  const folderInput = useRef<HTMLInputElement>(null)
  const zipInput = useRef<HTMLInputElement>(null)

  const [subdomain, setSubdomain] = useState('')
  const [selection, setSelection] = useState<Prepared | null>(null)
  const [allowNoIndex, setAllowNoIndex] = useState(false)
  const [progress, setProgress] = useState<PublishProgress | null>(null)
  const [result, setResult] = useState<PublishResult | null>(null)
  const [error, setError] = useState('')

  const busy = progress !== null

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

  const onWindowDrop = useCallback(
    async (transfer: DataTransfer) => {
      if (busy || !password) return
      try {
        accept(await filesFromDataTransfer(transfer))
      } catch (cause) {
        fail(cause)
      }
    },
    [busy, password],
  )

  const dragging = useWindowDrop(onWindowDrop)

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
      {dragging && (
        <div className="curtain">
          <Upload size={30} />
          <strong>Drop to publish</strong>
        </div>
      )}

      <Header onLock={lock} />

      <form onSubmit={onPublish}>
        <div className={`dropzone ${selection ? 'filled' : ''}`}>
          <span className="glyph">{selection ? <Check size={19} /> : <Folder size={19} />}</span>

          {selection ? (
            <>
              <strong>{plural(selection.files.length, 'file')}</strong>
              <span className="hint">{formatBytes(selection.bytes)} ready</span>
            </>
          ) : (
            <>
              <strong>Drop a folder or a .zip anywhere</strong>
              <span className="hint">Any file type. A lone .html becomes index.html.</span>
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

        <input
          ref={(node) => {
            folderInput.current = node
            node?.setAttribute('webkitdirectory', '')
            node?.setAttribute('directory', '')
          }}
          type="file"
          multiple
          hidden
          onChange={(event) => onPick(event.currentTarget)}
        />
        <input ref={zipInput} type="file" accept=".zip" hidden onChange={(event) => onPick(event.currentTarget)} />

        {selection && (selection.promoted || selection.ignored.length > 0 || selection.rejected.length > 0) && (
          <div className="notes">
            {selection.promoted && (
              <p className="note accent">
                <Wand size={14} />
                <span>
                  <code>{selection.promoted}</code> becomes <code>index.html</code>
                </span>
              </p>
            )}
            {selection.ignored.length > 0 && (
              <p className="note">
                <X size={14} />
                {plural(selection.ignored.length, 'dot-file')} ignored
              </p>
            )}
            {selection.rejected.map((path) => (
              <p className="note warn" key={path}>
                <Warning size={14} />
                <span>
                  Unsafe path skipped: <code>{path}</code>
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
              No <code>index.html</code> at the root. The site root will return 404. Publish anyway.
            </span>
          </label>
        )}

        <div className="field">
          <label className="cap" htmlFor="subdomain">
            Subdomain
          </label>
          <div className="combo">
            <input
              id="subdomain"
              type="text"
              value={subdomain}
              placeholder="Random name"
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setSubdomain(event.target.value.toLowerCase())}
            />
            <span className="suffix">.{ROOT_DOMAIN}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Generate a random name"
              disabled={busy}
              onClick={() => requestName('', password).then(setSubdomain).catch(fail)}
            >
              <Shuffle size={15} />
            </button>
          </div>
        </div>

        <button className="primary" type="submit" disabled={!canPublish}>
          {!busy && (selection?.promoted ? <Wand size={15} /> : <Upload size={15} />)}
          {label}
        </button>

        {progress && (
          <div className="progress">
            <div className="track">
              <div className="fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <p className="progress-label">
              <span>{progress.relPath || 'preparing'}</span>
              <span>
                {progress.done}/{progress.total}
              </span>
            </p>
          </div>
        )}

        {error && <Alert>{error}</Alert>}

        {result && (
          <div className="result">
            <div className="grow">
              <a className="url" href={siteUrl(result.subdomain)} target="_blank" rel="noreferrer">
                {result.subdomain}.{ROOT_DOMAIN}
              </a>
              <p className="meta">
                {plural(result.files, 'file')}
                {result.pruned > 0 && `, ${plural(result.pruned, 'stale file')} pruned`}
                {'. '}
                <Link href="/sites">Manage</Link>
              </p>
            </div>
            <CopyLink url={siteUrl(result.subdomain)} />
            <a
              className="icon-btn"
              href={siteUrl(result.subdomain)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${result.subdomain}.${ROOT_DOMAIN}`}
            >
              <External />
            </a>
          </div>
        )}
      </form>
    </main>
  )
}
