'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/alert'
import { Gate } from '@/components/gate'
import { Header } from '@/components/header'
import { Refresh } from '@/components/icons'
import { SiteRow } from '@/components/site-row'
import { deleteSite, fetchSites, renameSite } from '@/lib/api'
import { ROOT_DOMAIN } from '@/lib/config'
import { plural } from '@/lib/format'
import type { SiteSummary } from '@/lib/types'
import { usePassword } from '@/lib/use-password'

export default function Sites() {
  const { password, restoring, unlock, lock } = usePassword()

  const [sites, setSites] = useState<SiteSummary[] | null>(null)
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

  if (restoring) return <main className="wide" />
  if (!password) return <Gate onUnlock={unlock} />

  return (
    <main className="wide">
      <Header onLock={lock} />

      <div className="bar">
        <span className="count">{sites ? plural(sites.length, 'site') : 'Loading'}</span>
        <button className="ghost" type="button" onClick={() => refresh(password).catch(fail)}>
          <Refresh size={14} />
          Refresh
        </button>
      </div>

      {error && <Alert>{error}</Alert>}

      {!sites ? (
        <div className="rows" aria-busy>
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
      ) : sites.length === 0 ? (
        <p className="empty">
          Nothing published yet. <Link href="/">Drop a folder</Link> and it lands on {ROOT_DOMAIN} within seconds.
        </p>
      ) : (
        <div className="rows">
          {sites.map((site) => (
            <SiteRow
              key={site.subdomain}
              site={site}
              busy={pending === site.subdomain}
              onRename={(to) => guard(site.subdomain, () => renameSite(password, site.subdomain, to))}
              onDelete={() => guard(site.subdomain, () => deleteSite(password, site.subdomain))}
            />
          ))}
        </div>
      )}
    </main>
  )
}
