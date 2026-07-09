'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock } from './icons'
import { Wordmark } from './wordmark'

const TABS = [
  { href: '/', label: 'Drop' },
  { href: '/sites', label: 'Sites' },
]

export function Header({ onLock }: { onLock: () => void }) {
  const pathname = usePathname()

  return (
    <header className="head">
      <Link className="brand" href="/">
        <Wordmark />
      </Link>

      <div className="head-actions">
        <nav className="nav">
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? 'page' : undefined}>
              {tab.label}
            </Link>
          ))}
        </nav>
        <button className="ghost" type="button" onClick={onLock}>
          <Lock size={14} />
          Log out
        </button>
      </div>
    </header>
  )
}
