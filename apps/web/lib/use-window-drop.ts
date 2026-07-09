'use client'

import { useEffect, useRef, useState } from 'react'

const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false

/** Whether files are currently being dragged over the window. Drops fire `onDrop`. */
export function useWindowDrop(onDrop: (transfer: DataTransfer) => void): boolean {
  const [dragging, setDragging] = useState(false)
  const latest = useRef(onDrop)

  useEffect(() => {
    latest.current = onDrop
  })

  useEffect(() => {
    /**
     * Drag events fire on every element the pointer crosses, so a plain
     * dragleave would flicker the curtain. Counting enter/leave pairs tracks
     * whether the pointer is still anywhere inside the window.
     */
    let depth = 0

    const enter = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth += 1
      setDragging(true)
    }
    const over = (event: DragEvent) => carriesFiles(event) && event.preventDefault()
    const leave = (event: DragEvent) => {
      if (!carriesFiles(event)) return
      depth -= 1
      if (depth <= 0) setDragging(false)
    }
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event) || !event.dataTransfer) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      latest.current(event.dataTransfer)
    }

    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)

    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])

  return dragging
}
