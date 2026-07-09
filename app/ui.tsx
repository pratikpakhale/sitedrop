'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ROOT_DOMAIN } from '@/lib/config'
import { Check, Copy, Lock, LogoMark, Warning } from './icons'

const IS_LOCAL = ROOT_DOMAIN.startsWith('localhost')

export function siteUrl(subdomain: string): string {
  return `${IS_LOCAL ? 'http' : 'https'}://${subdomain}.${ROOT_DOMAIN}`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="brand">
      <div className="mark">
        <LogoMark size={19} />
      </div>
      <div>
        <h1>site drop</h1>
        <p className="sub">{subtitle}</p>
      </div>
    </div>
  )
}

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="nav">
      {[
        { href: '/', label: 'Drop' },
        { href: '/sites', label: 'Sites' },
      ].map((tab) => (
        <Link key={tab.href} href={tab.href} className={pathname === tab.href ? 'on' : ''}>
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

export function Alert({ children }: { children: string }) {
  return (
    <div className="alert">
      <Warning size={16} />
      {children}
    </div>
  )
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      className={`icon-btn ${copied ? 'done' : ''}`}
      title="Copy URL"
      onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
    >
      {copied ? <Check /> : <Copy />}
    </button>
  )
}

export function Gate({ onUnlock }: { onUnlock: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onUnlock(password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wrong password')
      setBusy(false)
    }
  }

  return (
    <main className="narrow">
      <Brand subtitle={`Publish a static folder to ${ROOT_DOMAIN}.`} />
      <form className="panel gate" onSubmit={submit}>
        <label htmlFor="password">Password</label>
        <div className="combo">
          <input
            id="password"
            type="password"
            value={password}
            autoFocus
            autoComplete="current-password"
            placeholder="••••••••••••"
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <button className="primary" type="submit" disabled={busy || !password}>
          <Lock size={16} />
          {busy ? 'Checking…' : 'Unlock'}
        </button>
        {error && <Alert>{error}</Alert>}
      </form>
    </main>
  )
}

export function Header({ subtitle, onLock }: { subtitle: string; onLock: () => void }) {
  return (
    <header className="head">
      <Brand subtitle={subtitle} />
      <div className="head-actions">
        <Nav />
        <button className="icon-btn" type="button" title="Lock" onClick={onLock}>
          <Lock size={15} />
        </button>
      </div>
    </header>
  )
}

/**
 * A live, scaled-down render of the published site. The iframe is sized to 4x
 * its container and scaled back down, which gives the framed page a
 * desktop-width viewport regardless of how wide the card is. `sandbox` without
 * `allow-same-origin` puts it in an opaque origin, so a dropped site cannot
 * touch cookies or storage from the preview.
 */
export function Preview({ url, version }: { url: string; version: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = box.current
    if (!node || visible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: '250px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [visible])

  return (
    <div className="preview" ref={box}>
      {visible && (
        <iframe
          src={`${url}/?v=${encodeURIComponent(version)}`}
          title=""
          aria-hidden
          tabIndex={-1}
          loading="lazy"
          scrolling="no"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts"
        />
      )}
    </div>
  )
}
