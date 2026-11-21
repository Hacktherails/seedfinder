// ECO wallet: floating card in the top-right corner of the map. Balance, impact, what this trip earns, how it works.
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Account, EcoProgram } from '../api/types'
import { fmtKg, fmtPrice } from '../format'
import type { Passport } from '../storage'
import CoinIcon from '../ui/CoinIcon'

interface Props {
  account: Account | null
  onChange: (a: Account | null) => void
  passport: Passport
  /** ECO points the tickets currently picked would earn (0 when nothing is picked). */
  earning: number
}

export default function EcoWallet({ account, onChange, passport, earning }: Props) {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [program, setProgram] = useState<EcoProgram | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.ecoProgram().then(setProgram, () => {})
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onChange(await api.signIn(email))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const worth = (points: number) => (program ? fmtPrice(points * program.point_value_cents) : null)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open ECO wallet"
        className="fixed top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-[var(--card)] px-3.5 py-2 text-[13px] font-medium text-[var(--green)] shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
      >
        {account ? account.points.toLocaleString('en') : 'ECO'}
        <CoinIcon />
      </button>
    )
  }

  return (
    <aside
      aria-label="ECO wallet"
      className="pop fixed top-3 right-3 z-20 w-[300px] max-w-[calc(100vw-24px)] rounded-3xl bg-[var(--card)] p-2 text-[13px] shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
    >
      {/* Balance: the green block, same nesting as the itinerary (24 px outer, 16 px inner) */}
      <div className="rounded-2xl bg-[var(--green-soft)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold tracking-widest text-[var(--green)] uppercase">ECO wallet</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close ECO wallet"
            className="-mr-1.5 grid size-7 place-items-center rounded-full text-[var(--green)] hover:bg-[var(--card)]"
          >
            ×
          </button>
        </div>

        {account ? (
          <>
            <p className="mt-1 flex items-center gap-2 text-[32px] leading-tight font-semibold tracking-tight text-[var(--green)]">
              {account.points.toLocaleString('en')}
              <CoinIcon className="size-6" />
            </p>
            {worth(account.points) && <p className="text-[var(--green)]">worth {worth(account.points)} on green tickets</p>}
          </>
        ) : (
          <p className="mt-1 text-[15px] leading-snug font-medium">Earn points on every green train ticket, spend them on the next one.</p>
        )}

        {earning > 0 && (
          <p className="mt-3 flex items-center justify-between rounded-xl bg-[var(--card)] px-3 py-2">
            <span>This trip</span>
            <span className="flex items-center gap-1 font-medium text-[var(--green)]">
              +{earning.toLocaleString('en')} <CoinIcon />
            </span>
          </p>
        )}
      </div>

      <div className="px-3 pt-3 pb-2">
        {account ? (
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat label="green trips" value={String(account.trips)} />
            <Stat label="CO₂ saved" value={fmtKg(account.co2_saved_g)} />
            <Stat label="stations" value={String(passport.stamps.length)} />
          </dl>
        ) : (
          <form onSubmit={submit}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label="Email"
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2 outline-none focus:border-[var(--ink)]"
            />
            {error && <p className="mt-2 text-[12px] text-[var(--red)]">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-xl bg-[var(--ink)] py-2.5 font-medium text-[var(--card)] disabled:opacity-60"
            >
              {busy ? 'Signing in…' : 'Join · 100 welcome points'}
            </button>
          </form>
        )}

        {program && (
          <ul className="mt-3 space-y-1.5 border-t border-[var(--line)] pt-3 text-[12px]">
            <Rule>
              <b>1 point</b> per {program.grams_per_point / 1000} kg of CO₂ saved vs flying
            </Rule>
            <Rule>
              <b>{Math.round(100 / program.point_value_cents)} points</b> = {fmtPrice(100)} off a green ticket
            </Rule>
            <Rule>
              Pay up to <b>{Math.round(program.max_discount_share * 100)} %</b> of a green ticket with points
            </Rule>
          </ul>
        )}

        {account && (
          <div className="mt-3 flex items-center justify-between text-[12px]">
            <span className="truncate text-[var(--muted)]">{account.email}</span>
            <button type="button" onClick={() => onChange(null)} className="ml-3 shrink-0 underline hover:text-[var(--green)]">
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse rounded-xl bg-[var(--hover)] px-1 py-2">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="text-[15px] font-semibold tracking-tight">{value}</dd>
    </div>
  )
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <CoinIcon className="mt-0.5 size-3 shrink-0 text-[var(--green)]" />
      <span>{children}</span>
    </li>
  )
}
