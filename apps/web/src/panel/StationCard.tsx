import type { Station } from '../api/types'

interface Props {
  station: Station
  role: 'none' | 'origin' | 'stop' | 'destination'
  canInsert: boolean
  onStart: () => void
  onGo: () => void
  onAddStop: () => void
  onClose: () => void
}

const ROLE_LABEL = { origin: 'Start', stop: 'Stopover', destination: 'Destination' } as const

const btn = 'rounded-xl border border-[var(--line)] px-4 py-3 text-[15px] font-medium hover:bg-[var(--hover)] active:scale-[0.98]'

export default function StationCard({ station, role, canInsert, onStart, onGo, onAddStop, onClose }: Props) {
  return (
    <div className="mx-4 mt-2 rounded-2xl border border-[var(--line)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[19px] font-semibold tracking-tight">{station.name}</h2>
          <div className="mt-0.5 flex items-center gap-2 text-[13px] text-[var(--muted)]">
            {station.country && <span>{station.country}</span>}
            {role !== 'none' && (
              <span className="rounded-full bg-[var(--red-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--red)]">
                {ROLE_LABEL[role]}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close station"
          className="grid size-9 shrink-0 place-items-center rounded-full text-[18px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
        >
          ×
        </button>
      </div>
      <div className="mt-4 grid gap-2">
        <button type="button" onClick={onStart} className={btn}>
          Start here
        </button>
        <button type="button" onClick={onGo} className={btn}>
          Go here
        </button>
        {canInsert && role === 'none' && (
          <button type="button" onClick={onAddStop} className={btn}>
            Add as stopover
          </button>
        )}
      </div>
      <p className="mt-3 hidden text-center text-[11px] text-[var(--muted)] md:block">Esc to go back</p>
    </div>
  )
}
