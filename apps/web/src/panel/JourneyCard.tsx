import type { Journey } from '../api/types'
import { fmtDur, fmtKg, fmtPrice, fmtTime, modeLabel } from '../format'

const TAG_LABEL = { cheapest: 'Cheapest', fastest: 'Fastest', greenest: 'Greenest' } as const

interface Props {
  j: Journey
  active: boolean
  open: boolean
  onHover: (id: string | null) => void
  onClick: () => void
  onBook: () => void
  booking: boolean
  actionLabel: string
}

export default function JourneyCard({ j, active, open, onHover, onClick, onBook, booking, actionLabel }: Props) {
  const first = j.legs[0]
  const last = j.legs[j.legs.length - 1]
  const saved = Math.max(0, 1 - j.co2_g / Math.max(1, j.co2_plane_g))
  const transit = j.legs.filter((l) => l.mode !== 'WALK')
  const night = j.legs.some((l) => l.mode === 'NIGHT_RAIL')
  const day = (iso: string, tz?: string | null) => new Intl.DateTimeFormat('en-CA', { timeZone: tz ?? undefined }).format(new Date(iso))
  const nextDay = day(j.arrival, last.destination.tz) > day(j.departure, first.origin.tz)

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
              {nextDay && <sup className="ml-0.5 text-[11px] text-[var(--muted)]">+1</sup>}
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

        {night && (
          <div className="mt-3 rounded-lg bg-[var(--hover)] px-2.5 py-1.5 text-[12px] font-medium">
            🌙 Night train · one hotel night saved
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span className="truncate text-[var(--muted)]">{j.operators.join(' · ')}</span>
          <span className="ml-3 shrink-0 text-[var(--green)]">
            🌱 {fmtKg(j.co2_g)} · −{Math.round(saved * 100)}% vs ✈︎
          </span>
        </div>
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
          <button
            type="button"
            onClick={onBook}
            disabled={booking}
            className="mt-4 flex w-full items-center justify-between rounded-xl bg-[var(--ink)] px-4 py-3 text-[15px] font-medium text-[var(--card)] transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <span>{booking ? 'Opening checkout…' : actionLabel}</span>
            <span>{fmtPrice(j.price_cents, j.currency)} →</span>
          </button>
          <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
            {transit.length} ticket{transit.length > 1 ? 's' : ''} · {j.operators.length} operator
            {j.operators.length > 1 ? 's' : ''} · one payment
          </p>
        </div>
      )}
    </li>
  )
}
