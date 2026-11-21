import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { Account } from '../api/types'
import { fmtKg } from '../format'

interface Props {
  account: Account | null
  onChange: (a: Account | null) => void
}

/** Demo sign-in: email only, no password. Shows the ECO points balance once signed in. */
export default function AccountChip({ account, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onChange(await api.signIn(email))
      setOpen(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors ${account ? 'bg-[var(--green-soft)] text-[var(--green)]' : 'border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--hover)]'}`}
      >
        {account ? `🌿 ${account.points.toLocaleString('en')} ECO` : 'Sign in · earn ECO'}
      </button>

      {open && (
        <div className="pop absolute top-9 right-0 z-20 w-72 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 text-[13px] shadow-xl">
          {account ? (
            <>
              <p className="truncate font-medium">{account.email}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--green)]">
                {account.points.toLocaleString('en')} <span className="text-[13px] font-medium">ECO points</span>
              </p>
              <p className="mt-1 text-[var(--muted)]">
                {account.trips} green trip{account.trips === 1 ? '' : 's'} · {fmtKg(account.co2_saved_g)} CO₂ kept out of the sky
              </p>
              <p className="mt-3 rounded-xl bg-[var(--hover)] p-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
                Earn 1 point per kg of CO₂ you save by taking the train instead of flying. Spend them on your next green
                ticket.
              </p>
              <button
                type="button"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className="mt-3 text-[12px] text-[var(--muted)] underline hover:text-[var(--ink)]"
              >
                Sign out
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <p className="font-medium">Join ECO rewards</p>
              <p className="mt-1 text-[12px] text-[var(--muted)]">
                Earn points on every green ticket, spend them on the next one. 100 welcome points.
              </p>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-3 w-full rounded-xl border border-[var(--line)] px-3 py-2 outline-none focus:border-[var(--ink)]"
              />
              {error && <p className="mt-2 text-[12px] text-[var(--red)]">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="mt-3 w-full rounded-xl bg-[var(--ink)] py-2.5 font-medium text-[var(--card)] disabled:opacity-60"
              >
                {busy ? 'Signing in…' : 'Continue'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
