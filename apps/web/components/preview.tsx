'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A live render of the published site. `sandbox` without `allow-same-origin`
 * puts the frame in an opaque origin, so a dropped site cannot reach cookies or
 * storage from the preview.
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
