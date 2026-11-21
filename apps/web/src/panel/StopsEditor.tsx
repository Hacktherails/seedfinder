import { useState, type Dispatch } from 'react'
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

const stepBtn = 'grid size-9 place-items-center rounded-full text-[18px] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:opacity-30'
const divider = <div className="mx-4 border-t border-[var(--line)]" />

export default function StopsEditor({ trip, dispatch, onFocus }: Props) {
  const [adding, setAdding] = useState<number | null>(null) // gap index = insertStop index
  const { stops } = trip
  const n = stops.length
  const plans = segmentPlans(trip)
  const lastOutbound = n >= 2 ? plans[n - 2].date : trip.departDate

  const setEnd = (index: number) => (s: Station | null) =>
    dispatch(s ? (index >= n ? { type: 'pick', station: s } : { type: 'setStop', index, station: s }) : { type: 'setStop', index, station: null })

  return (
    <div className="mx-4 rounded-2xl border border-[var(--line)]">
      <div className="relative">
        <StationInput label="From" dot="hollow" value={stops[0]?.station ?? null} onChange={setEnd(0)} autoFocus />
        {n < 2 && (
          <>
            {divider}
            <StationInput label="To" dot="solid" value={null} onChange={setEnd(1)} />
          </>
        )}
        {stops.slice(1).map((stop, k) => {
          const i = k + 1
          const last = i === n - 1
          return (
            <div key={`${stop.station.id}-${i}`}>
              {divider}
              {n < MAX_STOPS &&
                (adding === i ? (
                  <>
                    <StationInput
                      label="Stopover"
                      dot="solid"
                      value={null}
                      autoFocus
                      onChange={(s) => {
                        setAdding(null)
                        if (s) dispatch({ type: 'insertStop', index: i, station: s })
                      }}
                    />
                    {divider}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setAdding(i)}
                      className="w-full px-4 py-1.5 text-left text-[12px] text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      + Add stopover
                    </button>
                    {divider}
                  </>
                ))}
              {last ? (
                <StationInput label="To" dot="solid" value={stop.station} onChange={setEnd(i)} />
              ) : (
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="size-2.5 shrink-0 rounded-full border-2 border-[var(--ink)] bg-[var(--card)]" />
                  <button
                    type="button"
                    onClick={() => onFocus(stop.station)}
                    className="min-w-0 flex-1 truncate text-left text-base md:text-[15px]"
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
          )
        })}
        {n >= 2 && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'swapEnds' })}
            aria-label="Swap"
            className={`absolute right-3 grid size-8 place-items-center rounded-full border border-[var(--line)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--ink)] ${n === 2 ? 'top-1/2 -translate-y-1/2' : 'top-2'}`}
          >
            ⇅
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--line)] px-4 py-2.5 text-[13px]">
        <span className="text-[var(--muted)]">Date</span>
        <input
          type="date"
          value={trip.departDate}
          min={today()}
          onChange={(e) => e.target.value && dispatch({ type: 'setDepartDate', date: e.target.value })}
          className="bg-transparent font-mono text-base outline-none md:text-[13px]"
        />
        {n >= 2 && (
          <label className="ml-auto flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!trip.returnDate}
              onChange={(e) =>
                dispatch({ type: 'setReturnDate', date: e.target.checked ? addDays(lastOutbound, 1) : null })
              }
            />
            <span className="text-[var(--muted)]">Return</span>
          </label>
        )}
        {n >= 2 && trip.returnDate && (
          <input
            type="date"
            value={trip.returnDate}
            min={lastOutbound}
            onChange={(e) => e.target.value && dispatch({ type: 'setReturnDate', date: e.target.value })}
            className="basis-full bg-transparent font-mono text-base outline-none md:text-[13px]"
          />
        )}
      </div>
      {n >= 2 && (
        <p className="border-t border-[var(--line)] px-4 py-2 text-[11px] text-[var(--muted)]">
          Tip: drag the route onto a station to add a stopover
        </p>
      )}
    </div>
  )
}
