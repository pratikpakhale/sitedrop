'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from './icons'

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
      aria-label={copied ? 'Copied' : `Copy ${url}`}
      onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
    >
      {copied ? <Check /> : <Copy />}
    </button>
  )
}
