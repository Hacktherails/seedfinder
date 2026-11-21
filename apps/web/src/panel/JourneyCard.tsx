import type { Journey } from '../api/types'
import CoinIcon from '../ui/CoinIcon'
import { fmtDur, fmtPrice, fmtTime, modeLabel } from '../format'

type Seg = { kind: 'ride' | 'walk' | 'wait'; s: number; label: string }

/** Timeline of a journey: rides, walks and the waits between them, in seconds. */
function segments(j: Journey): Seg[] {
  const out: Seg[] = []
  j.legs.forEach((l, i) => {
    const prev = j.legs[i - 1]
    if (prev) {
      const wait = (Date.parse(l.origin.time) - Date.parse(prev.destination.time)) / 1000
      if (wait > 0) out.push({ kind: 'wait', s: wait, label: `Change at ${l.origin.name} · ${fmtDur(wait)}` })
    }
    const what = l.mode === 'WALK' ? 'Walk' : [modeLabel[l.mode] ?? l.mode, l.line].filter(Boolean).join(' ')
    out.push({
      kind: l.mode === 'WALK' ? 'walk' : 'ride',
      s: l.duration_s,
      label: `${what} · ${l.origin.name} → ${l.destination.name} · ${fmtDur(l.duration_s)}`,
    })
  })
  return out
}

const TAG_LABEL = { cheapest: 'Cheapest', fastest: 'Fastest', greenest: 'Greenest' } as const

interface Props {
  j: Journey
  /** Longest journey in the list: every strip shares this time scale, so a longer bar is a longer trip. */
  maxDuration: number
  active: boolean
  open: boolean
  onHover: (id: string | null) => void
  onClick: () => void
  onBook: () => void
  booking: boolean
  actionLabel: string
}

export default function JourneyCard({ j, maxDuration, active, open, onHover, onClick, onBook, booking, actionLabel }: Props) {
  const first = j.legs[0]
  const last = j.legs[j.legs.length - 1]
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
          </div>
          <div className="text-right">
            <div className="text-[19px] font-semibold tracking-tight">{fmtPrice(j.price_cents, j.currency)}</div>
            {j.travellers > 1 && <div className="text-[11px] text-[var(--muted)]">for {j.travellers}</div>}
            {j.eco_points > 0 && (
              <div
                className="mt-0.5 flex items-center justify-end gap-1 text-[13px] font-medium text-[var(--green)]"
                title={`${j.eco_points} ECO points earned with this booking`}
              >
                +{j.eco_points}
                <CoinIcon />
              </div>
            )}
            <div className="mt-0.5 flex justify-end gap-1">
              {j.tags.map((t) => (
                <span
                  key={t}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t === 'greenest' ? 'bg-[var(--green-soft)] text-[var(--green)]' : 'bg-[var(--green-soft)] text-[var(--green)]'}`}
                >
                  {TAG_LABEL[t]}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline on a scale shared by every card: thick = on board, thin with a ring = waiting to change, dotted = walk */}
        <div
          role="img"
          aria-label={segments(j).map((g) => g.label).join('; ')}
          style={{ width: `${Math.max(25, (100 * j.duration_s) / Math.max(1, maxDuration))}%` }}
          className="mt-3 flex h-2.5 items-center"
        >
          {segments(j).map((g, i) => (
            <span key={i} title={g.label} style={{ flexGrow: g.s, flexBasis: 0 }} className="relative flex h-full min-w-1.5 items-center">
              {g.kind === 'ride' ? (
                <span className={`h-1.5 w-full rounded-full ${active ? 'bg-[var(--green)]' : 'bg-[var(--ink)]'}`} />
              ) : g.kind === 'walk' ? (
                <span className="w-full border-t-2 border-dotted border-[var(--muted)]" />
              ) : (
                <>
                  <span className="h-px w-full bg-[var(--muted)]" />
                  <span className={`absolute left-1/2 size-2.5 -translate-x-1/2 rounded-full border-2 bg-[var(--card)] ${active ? 'border-[var(--green)]' : 'border-[var(--ink)]'}`} />
                </>
              )}
            </span>
          ))}
        </div>

        {night && (
          <div className="mt-3 rounded-lg bg-[var(--hover)] px-2.5 py-1.5 text-[12px] font-medium">
            🌙 Night train · one hotel night saved
          </div>
        )}

      </button>

      {open && (
        <div className="border-t border-[var(--line)] px-4 pt-3 pb-4">
          <ol className="relative ml-1 space-y-3 border-l border-dashed border-[var(--line)] pl-4">
            {transit.map((l, i) => (
              <li key={i} className="relative">
                <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-[var(--card)] bg-[var(--green)]" />
                <div className="flex justify-between gap-3 text-[13px]">
                  <span>
                    <span className="font-mono">{fmtTime(l.origin.time, l.origin.tz)}</span> {l.origin.name}
                  </span>
                  <span className="shrink-0 font-medium">{l.price_cents ? fmtPrice(l.price_cents) : 'incl.'}</span>
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
        </div>
      )}
    </li>
  )
}
