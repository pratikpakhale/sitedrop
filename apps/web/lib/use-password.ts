'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchSites } from './api'

const STORAGE_KEY = 'sitedrop.password'

export type Auth = {
  password: string | null
  restoring: boolean
  unlock: (secret: string) => Promise<void>
  lock: () => void
}

/** A stored secret is only trusted once `/api/sites` accepts it; a stale one is discarded. */
export function usePassword(): Auth {
  const [password, setPassword] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(true)

  const unlock = useCallback(async (secret: string) => {
    await fetchSites(secret)
    localStorage.setItem(STORAGE_KEY, secret)
    setPassword(secret)
  }, [])

  const lock = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setPassword(null)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return setRestoring(false)

    unlock(stored)
      .catch(() => localStorage.removeItem(STORAGE_KEY))
      .finally(() => setRestoring(false))
  }, [unlock])

  return { password, restoring, unlock, lock }
}
