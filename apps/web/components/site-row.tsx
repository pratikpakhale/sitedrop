'use client'

import { useState, type FormEvent } from 'react'
import { formatBytes, formatTimestamp, plural, siteUrl } from '@/lib/format'
import type { SiteSummary } from '@/lib/types'
import { CopyLink } from './copy-link'
import { Check, External, Pencil, Trash, X } from './icons'
import { Preview } from './preview'

type Mode = 'idle' | 'renaming' | 'confirming'

type SiteRowProps = {
  site: SiteSummary
  busy: boolean
  onRename: (to: string) => Promise<void>
  onDelete: () => void
}

export function SiteRow({ site, busy, onRename, onDelete }: SiteRowProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const [draft, setDraft] = useState(site.subdomain)
  const url = siteUrl(site.subdomain)

  function cancel() {
    setDraft(site.subdomain)
    setMode('idle')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (draft === site.subdomain) return cancel()
    await onRename(draft)
    setMode('idle')
  }

  return (
    <article className={`row ${busy ? 'busy' : ''}`}>
      <a className="thumb" href={url} target="_blank" rel="noreferrer" aria-label={`Open ${site.subdomain}`}>
        <Preview url={url} version={site.updatedAt} />
        <span className="open">
          <External size={15} />
        </span>
      </a>

      {mode === 'renaming' ? (
        <form className="rename" onSubmit={submit}>
          <div className="combo tight">
            <input
              value={draft}
              autoFocus
              aria-label="New subdomain"
              spellCheck={false}
              autoComplete="off"
              disabled={busy}
              onChange={(event) => setDraft(event.target.value.toLowerCase())}
              onKeyDown={(event) => event.key === 'Escape' && cancel()}
            />
          </div>
          <button className="icon-btn done" type="submit" aria-label="Save name" disabled={busy || !draft}>
            <Check />
          </button>
          <button className="icon-btn" type="button" aria-label="Cancel rename" onClick={cancel} disabled={busy}>
            <X />
          </button>
        </form>
      ) : (
        <>
          <div className="grow">
            <a className="name" href={url} target="_blank" rel="noreferrer">
              {site.subdomain}
            </a>
            <p className="meta">
              {plural(site.files, 'file')}, {formatBytes(site.bytes)}, {formatTimestamp(site.updatedAt)}
            </p>
          </div>

          {mode === 'confirming' ? (
            <div className="confirm">
              <span>Delete for good?</span>
              <button className="ghost" type="button" onClick={cancel}>
                Cancel
              </button>
              <button className="ghost danger" type="button" onClick={onDelete}>
                Delete
              </button>
            </div>
          ) : (
            <div className="actions">
              <button
                className="icon-btn"
                type="button"
                aria-label={`Rename ${site.subdomain}`}
                disabled={busy}
                onClick={() => setMode('renaming')}
              >
                <Pencil />
              </button>
              <CopyLink url={url} />
              <button
                className="icon-btn danger"
                type="button"
                aria-label={`Delete ${site.subdomain}`}
                disabled={busy}
                onClick={() => setMode('confirming')}
              >
                <Trash />
              </button>
            </div>
          )}
        </>
      )}
    </article>
  )
}
