import type { Stay } from '../api/types'
import { fmtPrice } from '../format'

const KIND_ICON = { hostel: '🛏️', hotel: '🏨', boutique: '✨' } as const

interface Props {
  offers: Stay[] | undefined
  selected: string | null
  onSelect: (id: string | null) => void
}

export default function StayList({ offers, selected, onSelect }: Props) {
  if (!offers) return <div className="h-40 animate-pulse rounded-2xl bg-[var(--hover)]" />
  const first = offers[0]
  return (
    <div>
      {first && (
        <p className="mb-2 px-1 text-[13px] text-[var(--muted)]">
          {first.nights} night{first.nights > 1 ? 's' : ''} from {first.checkin} · {first.guests} guest
          {first.guests > 1 ? 's' : ''}
        </p>
      )}
      <ul className="space-y-2">
        {offers.map((s) => {
          const on = selected === s.id
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(on ? null : s.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${on ? 'border-[var(--ink)]' : 'border-[var(--line)] hover:border-[var(--muted)]'}`}
              >
                <span className="text-[22px]">{KIND_ICON[s.kind]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{s.name}</span>
                  <span className="block text-[12px] text-[var(--muted)]">{fmtPrice(s.per_night_cents, s.currency)} / night</span>
                </span>
                <span className="text-right">
                  <span className="block text-[17px] font-semibold tracking-tight">{fmtPrice(s.price_cents, s.currency)}</span>
                  <span className={`block text-[11px] ${on ? 'text-[var(--green)]' : 'text-[var(--muted)]'}`}>
                    {on ? '✓ In your trip' : 'Add to trip'}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="mt-2 w-full rounded-xl py-2 text-[13px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
      >
        {selected ? 'Remove stay — I’ll sort it out myself' : 'No stay needed here'}
      </button>
    </div>
  )
}
