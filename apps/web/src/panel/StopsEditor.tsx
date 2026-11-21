// Itinerary: where and when. Every station can be dragged to reorder the trip (like Google Maps directions).
import { useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent } from 'react'
import type { Station } from '../api/types'
import { addDays, MAX_STOPS, segmentPlans, type Trip, type TripAction } from '../trip'
import StationInput from './StationInput'

interface Props {
  trip: Trip
  dispatch: Dispatch<TripAction>
  onFocus: (s: Station) => void
}

const fmtDay = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  )

const today = () => new Date().toISOString().slice(0, 10)

const stepBtn =
  'grid size-9 place-items-center rounded-full text-[18px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:opacity-30'
const headerBtn =
  'rounded-full px-2 py-0.5 text-[12px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:opacity-40 disabled:hover:bg-transparent'

interface Drag {
  from: number
  over: number // index the stop would land at
  dy: number
  rects: DOMRect[] // row boxes measured when the drag started
}

export default function StopsEditor({ trip, dispatch, onFocus }: Props) {
  const [adding, setAdding] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const rows = useRef<(HTMLLIElement | null)[]>([])
  const startY = useRef(0)

  const { stops } = trip
  const n = stops.length
  const plans = segmentPlans(trip)
  const lastOutbound = n >= 2 ? plans[n - 2].date : trip.departDate
  const canAdd = n >= 2 && n < MAX_STOPS

  const setEnd = (index: number) => (s: Station | null) =>
    dispatch(
      s
        ? index >= n
          ? { type: 'pick', station: s }
          : { type: 'setStop', index, station: s }
        : { type: 'setStop', index, station: null },
    )

  // Pointer drag (mouse and touch): the grabbed row follows the pointer, the others slide out of its way.
  const onDown = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    startY.current = e.clientY
    setDrag({ from: i, over: i, dy: 0, rects: rows.current.slice(0, n).map((r) => r!.getBoundingClientRect()) })
  }
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return
    const r = drag.rects
    const me = r[drag.from]
    const dy = Math.min(Math.max(e.clientY - startY.current, r[0].top - me.top), r[n - 1].bottom - me.bottom)
    // Land where the pointer is: rows of different heights make the dragged row's own centre unreliable.
    const over = r.filter((x, k) => k !== drag.from && x.top + x.height / 2 < e.clientY).length
    setDrag({ ...drag, dy, over })
  }
  const onUp = () => {
    if (drag && drag.over !== drag.from) dispatch({ type: 'moveStop', from: drag.from, to: drag.over })
    setDrag(null)
  }
  const onKey = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null
    if (to === null || to < 0 || to >= n) return
    e.preventDefault()
    dispatch({ type: 'moveStop', from: i, to })
    // Keep focus on the handle of the moved stop
    requestAnimationFrame(() => rows.current[to]?.querySelector<HTMLButtonElement>('[data-handle]')?.focus())
  }
  const shift = (k: number) => {
    if (!drag || k === drag.from) return 0
    const h = drag.rects[drag.from].height
    if (drag.from < drag.over && k > drag.from && k <= drag.over) return -h
    if (drag.over < drag.from && k >= drag.over && k < drag.from) return h
    return 0
  }

  return (
    <section className="mx-4" aria-labelledby="itinerary-title">
      <div className="mb-1.5 flex items-center gap-1 px-1">
        <h2 id="itinerary-title" className="mr-auto text-[11px] font-semibold tracking-widest text-[var(--muted)] uppercase">
          Itinerary
        </h2>
        <button
          type="button"
          disabled={!canAdd || adding}
          title={n < 2 ? 'Pick a departure and a destination first' : n >= MAX_STOPS ? `Up to ${MAX_STOPS} stations` : undefined}
          onClick={() => setAdding(true)}
          className={headerBtn}
        >
          + Stopover
        </button>
        {n >= 2 && (
          <button type="button" onClick={() => dispatch({ type: 'swapEnds' })} className={headerBtn}>
            ⇅ Reverse
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        {n < 2 ? (
          <>
            <StationInput label="From" dot="hollow" value={stops[0]?.station ?? null} onChange={setEnd(0)} autoFocus />
            <div className="mx-4 border-t border-[var(--line)]" />
            <StationInput label="To" dot="solid" value={null} onChange={setEnd(1)} />
          </>
        ) : (
          <ol aria-label="Stations, drag to reorder" className="relative">
            {stops.map((stop, i) => {
              const first = i === 0
              const last = i === n - 1
              const dragging = drag?.from === i
              const dy = dragging ? drag.dy : shift(i)
              const row = (
                <li
                  key={`${stop.station.id}-${i}`}
                  ref={(el) => {
                    rows.current[i] = el
                  }}
                  style={{ transform: dy ? `translateY(${dy}px)` : undefined }}
                  className={`relative flex items-center bg-[var(--card)] ${first ? 'rounded-t-2xl' : 'border-t border-[var(--line)]'} ${dragging ? 'z-10 rounded-xl shadow-lg ring-1 ring-[var(--line)]' : drag ? 'transition-transform duration-150' : ''}`}
                >
                  <button
                    type="button"
                    data-handle
                    aria-label={`Move ${stop.station.name}: drag, or use arrow up and down`}
                    onPointerDown={onDown(i)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={() => setDrag(null)}
                    onKeyDown={onKey(i)}
                    style={{ touchAction: 'none' }}
                    className={`ml-1 grid h-10 w-6 shrink-0 place-items-center rounded text-[15px] leading-none text-[var(--muted)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--red)] focus-visible:outline-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  >
                    ⠿
                  </button>
                  <div className="min-w-0 flex-1 [&_label]:pl-1">
                    {first || last ? (
                      <StationInput
                        label={first ? 'From' : 'To'}
                        dot={first ? 'hollow' : 'solid'}
                        value={stop.station}
                        onChange={setEnd(i)}
                      />
                    ) : (
                      <div className="flex items-center gap-2 py-2 pr-2 pl-1">
                        <span className="size-2.5 shrink-0 rounded-full border-2 border-[var(--ink)] bg-[var(--card)]" />
                        <button
                          type="button"
                          onClick={() => onFocus(stop.station)}
                          className="ml-1 min-w-0 flex-1 truncate text-left text-base md:text-[15px]"
                        >
                          {stop.station.name}
                          <span className="block text-[11px] text-[var(--muted)]">Departs {fmtDay(plans[i].date)}</span>
                        </button>
                        <button
                          type="button"
                          aria-label="Fewer nights"
                          disabled={stop.nights <= 0}
                          onClick={() => dispatch({ type: 'setNights', index: i, nights: stop.nights - 1 })}
                          className={stepBtn}
                        >
                          −
                        </button>
                        <span className="w-14 text-center text-[13px] tabular-nums">
                          {stop.nights} night{stop.nights === 1 ? '' : 's'}
                        </span>
                        <button
                          type="button"
                          aria-label="More nights"
                          disabled={stop.nights >= 14}
                          onClick={() => dispatch({ type: 'setNights', index: i, nights: stop.nights + 1 })}
                          className={stepBtn}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${stop.station.name}`}
                          onClick={() => dispatch({ type: 'removeStop', index: i })}
                          className={stepBtn}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
              if (!(adding && last)) return row
              // The new stopover goes right before the destination; drag it elsewhere afterwards.
              return [
                <li key="adding" className="flex items-center border-t border-[var(--line)] bg-[var(--hover)]">
                  <span className="ml-1 w-6 shrink-0" />
                  <div className="min-w-0 flex-1 [&_label]:pl-1">
                    <StationInput
                      label="Add a stopover"
                      dot="solid"
                      value={null}
                      autoFocus
                      onChange={(st) => {
                        setAdding(false)
                        if (st) dispatch({ type: 'insertStop', index: n - 1, station: st })
                      }}
                    />
                  </div>
                  <button type="button" aria-label="Cancel stopover" onClick={() => setAdding(false)} className={stepBtn}>
                    ×
                  </button>
                </li>,
                row,
              ]
            })}
          </ol>
        )}

        {/* Dates side by side: departure, then an optional return */}
        <div className="grid grid-cols-2 divide-x divide-[var(--line)] border-t border-[var(--line)]">
          <label className="block px-4 py-2">
            <span className="block text-[11px] text-[var(--muted)]">Depart</span>
            <input
              type="date"
              value={trip.departDate}
              min={today()}
              onChange={(e) => e.target.value && dispatch({ type: 'setDepartDate', date: e.target.value })}
              className="w-full bg-transparent font-mono text-base outline-none md:text-[13px]"
            />
          </label>
          {trip.returnDate ? (
            <div className="flex items-center pr-1">
              <label className="block min-w-0 flex-1 py-2 pl-4">
                <span className="block text-[11px] text-[var(--muted)]">↩ Return</span>
                <input
                  type="date"
                  value={trip.returnDate}
                  min={lastOutbound}
                  autoFocus
                  onChange={(e) => e.target.value && dispatch({ type: 'setReturnDate', date: e.target.value })}
                  className="w-full bg-transparent font-mono text-base outline-none md:text-[13px]"
                />
              </label>
              <button
                type="button"
                aria-label="Remove the return"
                onClick={() => dispatch({ type: 'setReturnDate', date: null })}
                className={stepBtn}
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => dispatch({ type: 'setReturnDate', date: addDays(lastOutbound, 1) })}
              className={`px-4 py-2 text-left text-[13px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)] ${n < 2 ? 'rounded-br-2xl' : ''}`}
            >
              + Add a return
            </button>
          )}
        </div>
        {n >= 2 && (
          <p className="border-t border-[var(--line)] px-4 py-2 text-[11px] text-[var(--muted)]">
            Drag ⠿ to reorder stations, or drag the route on the map onto a station
          </p>
        )}
      </div>
    </section>
  )
}
