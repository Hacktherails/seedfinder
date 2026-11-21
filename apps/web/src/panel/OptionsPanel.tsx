// Options: who travels and how. Deliberately separate from the itinerary (where and when).
import { useState } from 'react'
import { CHANGES, MAX_TRAVELLERS, PARTY_ROWS, summary, travellers, type TripOptions } from '../options'

interface Props {
  options: TripOptions
  onChange: (o: TripOptions) => void
}

const stepBtn =
  'grid size-8 place-items-center rounded-full border border-[var(--line)] bg-[var(--card)] text-[16px] text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30'

function Segmented<T extends string | number>({
  label,
  value,
  items,
  onChange,
}: {
  label: string
  value: T
  items: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[13px]">{label}</span>
      <div role="group" aria-label={label} className="flex rounded-lg bg-[var(--card)] p-0.5 text-[12px] shadow-sm">
        {items.map((it) => (
          <button
            key={String(it.value)}
            type="button"
            aria-pressed={value === it.value}
            onClick={() => onChange(it.value)}
            className={`rounded-md px-2.5 py-1 ${value === it.value ? 'bg-[var(--ink)] font-medium text-[var(--card)]' : 'text-[var(--muted)]'}`}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-2">
      <span>
        <span className="block text-[13px]">{label}</span>
        <span className="block text-[11px] text-[var(--muted)]">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-5 w-9 shrink-0 rounded-full bg-[var(--line)] transition-colors peer-checked:bg-[var(--ink)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--red)] after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-[var(--card)] after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  )
}

export default function OptionsPanel({ options: o, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const total = travellers(o.party)
  const set = (patch: Partial<TripOptions>) => onChange({ ...o, ...patch })

  return (
    <section className="mx-4 mt-4" aria-labelledby="options-title">
      <div className="rounded-2xl bg-[var(--hover)]">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span id="options-title" className="block text-[11px] font-semibold tracking-widest text-[var(--muted)] uppercase">
              Options
            </span>
            <span className="block truncate text-[13px]">{summary(o)}</span>
          </span>
          <span aria-hidden className={`text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`}>
            ⌄
          </span>
        </button>

        {open && (
          <div className="divide-y divide-[var(--line)] px-4 pb-3">
            <fieldset className="pb-2">
              <legend className="sr-only">Travellers</legend>
              {PARTY_ROWS.map((r) => {
                const v = o.party[r.key]
                return (
                  <div key={r.key} className="flex items-center justify-between py-1.5">
                    <span>
                      <span className="block text-[13px]">{r.label}</span>
                      <span className="block text-[11px] text-[var(--muted)]">{r.hint}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Fewer ${r.label.toLowerCase()}`}
                        disabled={v <= 0 || total <= 1}
                        onClick={() => set({ party: { ...o.party, [r.key]: v - 1 } })}
                        className={stepBtn}
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-[14px] tabular-nums">{v}</span>
                      <button
                        type="button"
                        aria-label={`More ${r.label.toLowerCase()}`}
                        disabled={total >= MAX_TRAVELLERS}
                        onClick={() => set({ party: { ...o.party, [r.key]: v + 1 } })}
                        className={stepBtn}
                      >
                        +
                      </button>
                    </span>
                  </div>
                )
              })}
            </fieldset>
            <Segmented
              label="Class"
              value={o.travelClass}
              items={[
                { value: 2, label: '2nd' },
                { value: 1, label: '1st' },
              ]}
              onChange={(travelClass) => set({ travelClass })}
            />
            <Segmented label="Changes" value={o.maxTransfers} items={CHANGES} onChange={(maxTransfers) => set({ maxTransfers })} />
            <Toggle
              label="All stations in the city"
              hint="Leave or arrive from any station within walking distance"
              on={o.anyStation}
              onChange={(anyStation) => set({ anyStation })}
            />
            <Toggle
              label="Add stays"
              hint="A room wherever you spend nights, paid in the same checkout"
              on={o.stays}
              onChange={(stays) => set({ stays })}
            />
          </div>
        )}
      </div>
    </section>
  )
}
