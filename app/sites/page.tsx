'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { deleteSite, fetchSites, renameSite } from '@/lib/api'
import { ROOT_DOMAIN } from '@/lib/config'
import type { SiteSummary } from '@/lib/types'
import { usePassword } from '@/lib/use-password'
import { Check, External, Pencil, Refresh, Trash, X } from '../icons'
import { Alert, CopyLink, formatBytes, Gate, Header, plural, Preview, siteUrl } from '../ui'

function when(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type CardProps = {
  site: SiteSummary
  busy: boolean
  onRename: (to: string) => Promise<void>
  onDelete: () => void
}

function Card({ site, busy, onRename, onDelete }: CardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(site.subdomain)

  function cancel() {
    setDraft(site.subdomain)
    setEditing(false)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (draft === site.subdomain) return cancel()
    await onRename(draft)
    setEditing(false)
  }

  return (
    <article className={`card ${busy ? 'busy' : ''}`}>
      <a className="shot" href={siteUrl(site.subdomain)} target="_blank" rel="noreferrer">
        <Preview url={siteUrl(site.subdomain)} version={site.updatedAt} />
        <span className="shot-open">
          <External size={14} />
          Open
        </span>
      </a>

      {editing ? (
        <form className="card-foot" onSubmit={submit}>
          <div className="combo tight">
            <input
              value={draft}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              disabled={busy}
              onChange={(event) => setDraft(event.target.value.toLowerCase())}
              onKeyDown={(event) => event.key === 'Escape' && cancel()}
            />
          </div>
          <button className="icon-btn done" type="submit" title="Save" disabled={busy || !draft}>
            <Check />
          </button>
          <button className="icon-btn" type="button" title="Cancel" onClick={cancel} disabled={busy}>
            <X />
          </button>
        </form>
      ) : (
        <div className="card-foot">
          <div className="grow">
            <a href={siteUrl(site.subdomain)} target="_blank" rel="noreferrer">
              {site.subdomain}
            </a>
            <div className="meta">
              {plural(site.files, 'file')} · {formatBytes(site.bytes)} · {when(site.updatedAt)}
            </div>
          </div>
          <div className="actions">
            <button
              className="icon-btn"
              type="button"
              title="Rename"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </button>
            <CopyLink url={siteUrl(site.subdomain)} />
            <button className="icon-btn danger" type="button" title="Delete" disabled={busy} onClick={onDelete}>
              <Trash />
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

export default function Sites() {
  const { password, restoring, unlock, lock } = usePassword()

  const [sites, setSites] = useState<SiteSummary[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async (secret: string) => {
    setSites(await fetchSites(secret))
  }, [])

  useEffect(() => {
    if (password) refresh(password).catch(() => undefined)
  }, [password, refresh])

  function fail(cause: unknown) {
    setError(cause instanceof Error ? cause.message : 'Something went wrong')
  }

  async function guard(subdomain: string, work: () => Promise<unknown>) {
    if (!password) return
    setPending(subdomain)
    setError('')
    try {
      await work()
      await refresh(password)
    } catch (cause) {
      fail(cause)
    } finally {
      setPending(null)
    }
  }

  if (restoring) return <main />
  if (!password) return <Gate onUnlock={unlock} />

  return (
    <main className="wide">
      <Header subtitle={`${plural(sites.length, 'site')} published on ${ROOT_DOMAIN}.`} onLock={lock} />

      <div className="sites-head">
        <h2>Sites</h2>
        <button className="ghost" type="button" onClick={() => refresh(password).catch(fail)}>
          <Refresh size={14} />
          Refresh
        </button>
      </div>

      {error && <Alert>{error}</Alert>}

      {sites.length === 0 ? (
        <div className="empty">
          Nothing published yet. <Link href="/">Drop something</Link>.
        </div>
      ) : (
        <div className="grid">
          {sites.map((site) => (
            <Card
              key={site.subdomain}
              site={site}
              busy={pending === site.subdomain}
              onRename={(to) => guard(site.subdomain, () => renameSite(password, site.subdomain, to))}
              onDelete={() => {
                if (confirm(`Delete ${site.subdomain}.${ROOT_DOMAIN} and all of its files?`)) {
                  guard(site.subdomain, () => deleteSite(password, site.subdomain))
                }
              }}
            />
          ))}
        </div>
      )}
    </main>
  )
}
