import { useEffect, useState } from 'react'
import { api } from './api/client'
import type { Health } from './api/types'

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.health().then(setHealth, (e: Error) => setError(e.message))
  }, [])

  return (
    <main className="mx-auto flex h-full max-w-3xl flex-col justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">🚆 Train Scanner</h1>
      <p className="text-slate-400">Search, compare, combine and pay for multi-leg journeys across Europe.</p>
      {error && <p className="rounded bg-red-900/60 p-3">API error: {error} — is `npm run dev:api` running?</p>}
      {health && (
        <ul className="text-sm text-slate-300">
          <li>API: {health.status}</li>
          <li>Stripe (server): {health.stripe_configured ? 'configured' : 'missing STRIPE_SECRET_KEY'}</li>
          <li>Stripe (browser): {import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? 'configured' : 'missing VITE_STRIPE_PUBLISHABLE_KEY'}</li>
        </ul>
      )}
    </main>
  )
}
