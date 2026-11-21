import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Account, Journey, Quote } from '../api/types'
import { fmtDur, fmtKg, fmtPrice, fmtTime, modeLabel } from '../format'

const TAG_LABEL = { cheapest: 'Cheapest', fastest: 'Fastest', greenest: 'Greenest' } as const

interface Props {
  j: Journey
  active: boolean
  open: boolean
  onHover: (id: string | null) => void
  onClick: () => void
  onBook: (usePoints: boolean) => void
  booking: boolean
  account: Account | null
}

export default function JourneyCard({ j, active, open, onHover, onClick, onBook, booking, account }: Props) {
  const first = j.legs[0]
  const last = j.legs[j.legs.length - 1]
  const saved = Math.max(0, 1 - j.co2_g / Math.max(1, j.co2_plane_g))
  const transit = j.legs.filter((l) => l.mode !== 'WALK')

  return (
    <li
      onMouseEnter={() => onHover(j.id)}
      onMouseLeave={() => onHover(null)}
      className={`rounded-2xl border transition-colors ${active ? 'border-[var(--ink)]' : 'border-[var(--line)] hover:border-[var(--muted)]'}`}
    >
      <button type="button" onClick={onClick} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[17px] tracking-tight">
              {fmtTime(j.departure, first.origin.tz)} <span className="text-[var(--muted)]">→</span>{' '}
              {fmtTime(j.arrival, last.destination.tz)}
            </div>
            <div className="mt-0.5 text-[13px] text-[var(--muted)]">
              {fmtDur(j.duration_s)} · {j.transfers === 0 ? 'Direct' : `${j.transfers} change${j.transfers > 1 ? 's' : ''}`}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[19px] font-semibold tracking-tight">{fmtPrice(j.price_cents, j.currency)}</div>
            <div className="mt-0.5 flex justify-end gap-1">
              {j.tags.map((t) => (
                <span
                  key={t}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t === 'greenest' ? 'bg-[var(--green-soft)] text-[var(--green)]' : 'bg-[var(--red-soft)] text-[var(--red)]'}`}
                >
                  {TAG_LABEL[t]}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Leg strip: one segment per train, sized by duration */}
        <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
          {j.legs.map((l, i) => (
            <span
              key={i}
              style={{ flexGrow: l.duration_s }}
              className={l.mode === 'WALK' ? 'bg-[var(--line)]' : active ? 'bg-[var(--red)]' : 'bg-[var(--ink)]'}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span className="truncate text-[var(--muted)]">{j.operators.join(' · ')}</span>
          <span className="ml-3 shrink-0 text-[var(--green)]">
            🌱 {fmtKg(j.co2_g)} · −{Math.round(saved * 100)}% vs ✈︎
          </span>
        </div>
        {j.green && j.eco_points > 0 && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--green-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--green)]">
            🌿 Green ticket · +{j.eco_points} ECO points
          </div>
        )}
      </button>

      {open && (
        <div className="border-t border-[var(--line)] px-4 pt-3 pb-4">
          <ol className="relative ml-1 space-y-3 border-l border-dashed border-[var(--line)] pl-4">
            {transit.map((l, i) => (
              <li key={i} className="relative">
                <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-[var(--card)] bg-[var(--red)]" />
                <div className="flex justify-between gap-3 text-[13px]">
                  <span>
                    <span className="font-mono">{fmtTime(l.origin.time, l.origin.tz)}</span> {l.origin.name}
                  </span>
                  <span className="shrink-0 font-medium">{l.price_cents ? fmtPrice(l.price_cents) : 'incl.'}</span>
                </div>
                <div className="text-[12px] text-[var(--muted)]">
                  {modeLabel[l.mode] ?? l.mode} · {l.operator} {l.line} · {fmtDur(l.duration_s)}
                </div>
                <div className="text-[13px]">
                  <span className="font-mono">{fmtTime(l.destination.time, l.destination.tz)}</span> {l.destination.name}
                </div>
              </li>
            ))}
          </ol>
          <BookBox j={j} account={account} booking={booking} onBook={onBook} />
          <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
            {transit.length} ticket{transit.length > 1 ? 's' : ''} · {j.operators.length} operator
            {j.operators.length > 1 ? 's' : ''} · one payment
          </p>
        </div>
      )}
    </li>
  )
}

/** Price, ECO points toggle and book button. Every amount comes from the API quote. */
function BookBox({
  j,
  account,
  booking,
  onBook,
}: {
  j: Journey
  account: Account | null
  booking: boolean
  onBook: (usePoints: boolean) => void
}) {
  const [usePoints, setUsePoints] = useState(true)
  const [fetched, setQuote] = useState<Quote | null>(null)
  const accountId = account?.id ?? null
  const balance = account?.points ?? 0
  const quote = accountId ? fetched : null

  useEffect(() => {
    if (!accountId) return
    const ctrl = new AbortController()
    api.quote(j.id, accountId, usePoints, ctrl.signal).then(setQuote, () => {})
    return () => ctrl.abort()
  }, [j.id, accountId, balance, usePoints])

  const canRedeem = (quote?.max_points ?? 0) > 0
  const spending = canRedeem && usePoints && quote ? quote : null
  const total = spending ? spending.total_cents : j.price_cents

  return (
    <>
      {account && j.green && quote && (
        <div className="mt-4 rounded-xl border border-[var(--green-soft)] bg-[var(--green-soft)]/50 p-3 text-[13px]">
          {canRedeem ? (
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <span>
                Use <b>{quote.max_points}</b> of your {quote.balance} ECO points
              </span>
              <span className="flex items-center gap-2">
                {spending && (
                  <span className="font-medium text-[var(--green)]">−{fmtPrice(spending.discount_cents, j.currency)}</span>
                )}
                <input
                  type="checkbox"
                  checked={usePoints}
                  onChange={(e) => setUsePoints(e.target.checked)}
                  className="size-4 accent-[var(--green)]"
                />
              </span>
            </label>
          ) : (
            <p className="text-[var(--muted)]">You have {quote.balance} ECO points. Collect a few more to spend them.</p>
          )}
          <p className="mt-1.5 text-[12px] text-[var(--green)]">🌿 You earn +{quote.points_earned} ECO points with this trip</p>
        </div>
      )}
      {!account && j.green && j.eco_points > 0 && (
        <p className="mt-4 rounded-xl bg-[var(--hover)] p-3 text-[12px] text-[var(--muted)]">
          Sign in to earn <b className="text-[var(--green)]">+{j.eco_points} ECO points</b> on this trip and spend them on
          your next green ticket.
        </p>
      )}
      <button
        type="button"
        onClick={() => onBook(Boolean(spending))}
        disabled={booking}
        className="mt-4 flex w-full items-center justify-between rounded-xl bg-[var(--ink)] px-4 py-3 text-[15px] font-medium text-[var(--card)] transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        <span>{booking ? 'Opening checkout…' : 'Book all tickets'}</span>
        <span>
          {spending && (
            <span className="mr-2 text-[13px] font-normal line-through opacity-60">{fmtPrice(j.price_cents, j.currency)}</span>
          )}
          {fmtPrice(total, j.currency)} →
        </span>
      </button>
    </>
  )
}
