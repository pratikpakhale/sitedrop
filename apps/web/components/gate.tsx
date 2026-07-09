'use client'

import { useState, type FormEvent } from 'react'
import { Alert } from './alert'
import { Lock } from './icons'
import { Wordmark } from './wordmark'

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
      <div className="brand">
        <Wordmark />
      </div>

      <form onSubmit={submit}>
        <label className="cap" htmlFor="password">
          Password
        </label>
        <div className="combo">
          <input
            id="password"
            type="password"
            value={password}
            autoFocus
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <button className="primary" type="submit" disabled={busy || !password}>
          <Lock size={15} />
          {busy ? 'Checking' : 'Unlock'}
        </button>
        {error && <Alert>{error}</Alert>}
      </form>
    </main>
  )
}
