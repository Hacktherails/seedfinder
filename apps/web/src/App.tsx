import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { api } from './api/client'
import type { Basket, Journey, JourneySearch, Network, Station, Stay } from './api/types'
import { fmtKg, fmtPrice } from './format'
import { greatCircle, journeyPath } from './map/geo'
import TrainMap from './map/TrainMap'
import { defaultOptions, travellers, type TripOptions } from './options'
import JourneyCard from './panel/JourneyCard'
import OptionsPanel from './panel/OptionsPanel'
import Sheet, { type Snap } from './panel/Sheet'
import StationCard from './panel/StationCard'
import StayList from './panel/StayList'
import StopsEditor from './panel/StopsEditor'
import { load, save, type Passport } from './storage'
import { initialTrip, MAX_STOPS, segmentPlans, staySlots, tripReducer } from './trip'

type Sort = 'best' | 'cheapest' | 'fastest' | 'greenest'
const SORTS: Sort[] = ['best', 'cheapest', 'fastest', 'greenest']

function sortJourneys(js: Journey[], sort: Sort): Journey[] {
  const by = (f: (j: Journey) => number) => [...js].sort((a, b) => f(a) - f(b))
  if (sort === 'cheapest') return by((j) => j.price_cents)
  if (sort === 'fastest') return by((j) => j.duration_s)
  if (sort === 'greenest') return by((j) => j.co2_g)
  const span = (f: (j: Journey) => number) => {
    const v = js.map(f)
    const lo = Math.min(...v)
    return (j: Journey) => (f(j) - lo) / (Math.max(...v) - lo || 1)
  }
  const p = span((j) => j.price_cents)
  const d = span((j) => j.duration_s)
  const c = span((j) => j.co2_g)
  return by((j) => p(j) * 0.45 + d(j) * 0.4 + c(j) * 0.15)
}

const PEEK_PX = 150
const hasWebGL = !!document.createElement('canvas').getContext('webgl2')
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

/** One synthetic journey for the whole trip, so the ride plays every segment in a row. */
function combine(js: Journey[]): Journey {
  const first = js[0]
  const sum = (f: (j: Journey) => number) => js.reduce((a, j) => a + f(j), 0)
  return {
    id: 'trip',
    departure: first.departure,
    arrival: js[js.length - 1].arrival,
    duration_s: sum((j) => j.duration_s),
    transfers: sum((j) => j.transfers),
    price_cents: sum((j) => j.price_cents),
    currency: first.currency,
    co2_g: sum((j) => j.co2_g),
    co2_plane_g: sum((j) => j.co2_plane_g),
    operators: [...new Set(js.flatMap((j) => j.operators))],
    tags: [],
    legs: js.flatMap((j) => j.legs),
    travellers: first.travellers,
    travel_class: first.travel_class,
  }
}

type LoaderStatus = 'idle' | 'loading' | 'done' | 'error'

export default function App() {
  const [network, setNetwork] = useState<Network | null>(null)
  const [trip, dispatch] = useReducer(tripReducer, undefined, initialTrip)
  const [options, setOptionsState] = useState<TripOptions>(() => ({ ...defaultOptions(), ...load('options', {}) }))
  const setOptions = (o: TripOptions) => {
    setOptionsState(o)
    save('options', o)
  }
  const [stayOffers, setStayOffers] = useState<Record<string, Stay[]>>({})
  const [staySel, setStaySel] = useState<Record<string, string | null>>({})
  const [activeStay, setActiveStay] = useState<string | null>(null)
  const [focus, setFocus] = useState<Station | null>(null)
  const [snap, setSnap] = useState<Snap>('half')
  const [searches, setSearches] = useState<JourneySearch[]>([])
  const [status, setStatus] = useState<LoaderStatus>('idle')
  const [landed, setLanded] = useState(false) // loader train reached the end; results may show
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [activeSeg, setActiveSeg] = useState(0)
  const [selected, setSelected] = useState<Record<number, string>>({})
  const [sort, setSort] = useState<Sort>('best')
  const [hovered, setHovered] = useState<string | null>(null)
  const [basket, setBasket] = useState<{ key: string; data: Basket } | null>(null)
  const [basketError, setBasketError] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  const [ride, setRide] = useState<Journey | null>(null)
  const [arrived, setArrived] = useState<Journey | null>(null)
  const [passport, setPassport] = useState<Passport>(() => load('passport', { stamps: [], co2SavedG: 0, trips: 0 }))
  const [isPhone, setIsPhone] = useState(() => !window.matchMedia('(min-width: 768px)').matches)
  const rideCities = useRef<string[]>([])

  useEffect(() => {
    api.network().then(setNetwork, () => {})
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = () => setIsPhone(!mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Back from Stripe: replay the booked trip as one ride, then stamp the passport
  useEffect(() => {
    const paid = new URLSearchParams(location.search).get('paid')
    const pending = load<{ searches: JourneySearch[]; ids: string[] } | null>('pending', null, 'session')
    if (!paid || !pending || pending.ids.join(',') !== paid) return
    history.replaceState(null, '', '/')
    const js = pending.ids.map((id) => pending.searches.flatMap((s) => s.journeys).find((j) => j.id === id))
    if (js.some((j) => !j)) return
    rideCities.current = pending.searches.flatMap((s) => [s.origin.name, s.destination.name])
    // No cleanup: StrictMode re-runs this effect after ?paid is already stripped, so a cleared timer would never ride.
    setTimeout(() => setRide(combine(js as Journey[])), 1800)
  }, [])

  const plans = segmentPlans(trip)
  const { party, travelClass, maxTransfers, anyStation } = options
  const guests = travellers(party)
  // Everything that changes the offers: itinerary + options (stays are fetched apart)
  const planKey = plans.length
    ? plans.map((p) => `${p.from.id}>${p.to.id}@${p.date}`).join('|') +
      `#${JSON.stringify(party)}/${travelClass}/${maxTransfers}/${anyStation}`
    : ''

  // Search every segment shortly after the trip stops changing
  useEffect(() => {
    if (!planKey) {
      setSearches([])
      setStatus('idle')
      return
    }
    const ctrl = new AbortController()
    setLanded(false)
    setStatus('loading')
    setError(null)
    setSnap('peek')
    const t = setTimeout(() => {
      const near = (s: Station) => (anyStation ? `${s.lat},${s.lon}` : undefined)
      const query = (p: (typeof plans)[number]) => ({
        from: p.from.id,
        to: p.to.id,
        date: p.date,
        max_transfers: maxTransfers,
        ...party,
        travel_class: travelClass,
        from_near: near(p.from),
        to_near: near(p.to),
      })
      Promise.all(plans.map((p) => api.journeys(query(p), ctrl.signal))).then(
        (r) => {
          setSearches(r)
          setActiveSeg(0)
          setActiveStay(null)
          setSelected(
            Object.fromEntries(r.flatMap((s, i) => (s.journeys.length ? [[i, sortJourneys(s.journeys, 'best')[0].id]] : []))),
          )
          setStatus('done')
        },
        (e: Error) => {
          if (ctrl.signal.aborted) return
          setError(e.message)
          setStatus('error')
        },
      )
    }, 400)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [planKey, retry])

  const onArrived = () => {
    setLanded(true)
    setSnap('half')
  }
  // Without the map there is no loader train to wait for
  useEffect(() => {
    if (!hasWebGL && status === 'done') onArrived()
  }, [status])

  const segment = searches[activeSeg]
  const journeys = useMemo(() => (segment ? sortJourneys(segment.journeys, sort) : []), [segment, sort])
  const activeSelected = selected[activeSeg] ?? null

  // Stays: one slot wherever the trip spends nights, offers fetched per slot
  const slots = options.stays ? staySlots(trip, plans) : []
  const slotsKey = slots.map((s) => s.key).join('|') + `x${guests}`
  useEffect(() => {
    if (!slots.length) return
    const ctrl = new AbortController()
    for (const s of slots) {
      const q = { city: s.station.name, lat: s.station.lat, lon: s.station.lon, checkin: s.checkin, nights: s.nights, guests }
      api.stays(q, ctrl.signal).then(
        (offers) => {
          setStayOffers((o) => ({ ...o, [s.key]: offers }))
          // Preselect the mid-range room the first time a slot appears
          setStaySel((sel) => (s.key in sel && offers.some((x) => x.id === sel[s.key]) ? sel : { ...sel, [s.key]: offers[1]?.id ?? null }))
        },
        () => {},
      )
    }
    return () => ctrl.abort()
  }, [slotsKey])
  const stayIds = slots.flatMap((s) => {
    const id = staySel[s.key]
    return id && stayOffers[s.key]?.some((x) => x.id === id) ? [id] : []
  })
  const staySlot = slots.find((s) => s.key === activeStay)

  const ids = searches.map((_, i) => selected[i])
  const basketKey = ids.length && ids.every(Boolean) ? `${ids.join(',')};${stayIds.join(',')}` : ''
  useEffect(() => {
    setBasketError(null)
    if (!basketKey) return
    let stale = false
    const [js, ss] = basketKey.split(';').map((x) => x.split(',').filter(Boolean))
    api.basket(js, ss).then(
      (data) => !stale && setBasket({ key: basketKey, data }),
      (e: Error) => !stale && setBasketError(e.message),
    )
    return () => {
      stale = true
    }
  }, [basketKey])
  const total = basket?.key === basketKey ? basket.data : null

  const stations = useMemo(() => {
    const s = new Map<string, Station>()
    for (const h of network?.hubs ?? []) s.set(h.name, h)
    for (const j of segment?.journeys ?? [])
      for (const l of j.legs)
        if (l.mode !== 'WALK')
          for (const p of [l.origin, l.destination])
            // Only stops with a real Transitous id can be searched from; a name is rejected upstream (404).
            if (p.id && !s.has(p.name)) s.set(p.name, { id: p.id, name: p.name, lat: p.lat, lon: p.lon })
    return [...s.values()]
  }, [network, segment])

  const segmentPaths = useMemo(
    () =>
      plans.map((p, i) => {
        const s = searches[i]
        const j = s?.origin.id === p.from.id && s.destination.id === p.to.id ? s.journeys.find((x) => x.id === selected[i]) : undefined
        return j ? journeyPath(j) : greatCircle([p.from.lon, p.from.lat], [p.to.lon, p.to.lat])
      }),
    [planKey, searches, selected],
  )

  const choose = (i: number, id: string) => setSelected((s) => ({ ...s, [i]: id }))
  const chooseAndAdvance = (id: string) => {
    choose(activeSeg, id)
    // Next stop of the trip: the stay where this segment arrives, else the next unchosen segment
    const stay = slots.find((s) => s.after === activeSeg)
    if (stay) return setActiveStay(stay.key)
    const next = searches.findIndex((_, i) => i !== activeSeg && !selected[i])
    if (next >= 0) setActiveSeg(next)
  }
  const openSeg = (i: number) => {
    setActiveSeg(i)
    setActiveStay(null)
  }

  const book = async () => {
    setBooking(true)
    try {
      const [picked, stays] = basketKey.split(';').map((x) => x.split(',').filter(Boolean))
      save('pending', { searches, ids: picked }, 'session')
      const { url } = await api.checkout(picked, stays)
      location.href = url
    } catch (e) {
      setBasketError((e as Error).message)
      setBooking(false)
    }
  }

  const endRide = () => {
    const j = ride
    setRide(null)
    if (!j) return
    const next: Passport = {
      stamps: [...new Set([...passport.stamps, ...rideCities.current])],
      co2SavedG: passport.co2SavedG + Math.max(0, j.co2_plane_g - j.co2_g),
      trips: passport.trips + 1,
    }
    setPassport(next)
    save('passport', next)
    setArrived(j)
  }

  const tapStation = (s: Station) => {
    setFocus((f) => (f?.id === s.id ? f : s))
    setSnap('half')
  }

  const last = trip.stops.length - 1
  const focusIndex = focus ? trip.stops.findIndex((s) => s.station.id === focus.id) : -1
  const role = focusIndex < 0 ? 'none' : focusIndex === 0 ? 'origin' : focusIndex === last ? 'destination' : 'stop'
  const thenUnfocus = (action: () => void) => () => {
    action()
    setFocus(null)
  }

  const loading = status === 'loading' || (status === 'done' && !landed)
  const visiblePx = snap === 'peek' ? PEEK_PX : snap === 'half' ? window.innerHeight / 2 : window.innerHeight - 48
  const padding = isPhone ? { top: 0, right: 0, left: 0, bottom: visiblePx } : { top: 0, right: 0, bottom: 0, left: 412 }

  return (
    <div className="relative h-full overflow-hidden">
      {hasWebGL && (
        <TrainMap
          network={network}
          journeys={ride ? [ride] : (segment?.journeys ?? [])}
          activeId={hovered ?? activeSelected}
          ride={ride}
          stations={stations}
          padding={padding}
          trip={trip}
          segmentPaths={segmentPaths}
          focus={focus}
          onExitFocus={() => setFocus(null)}
          dispatch={dispatch}
          loader={{ status, onArrived }}
          onHover={setHovered}
          onSelect={(id) => choose(activeSeg, id)}
          onStationClick={tapStation}
          onRideEnd={endRide}
        />
      )}

      <Sheet snap={snap} onSnapChange={setSnap} label="Trip planner" hidden={!!ride}>
        <header className="flex items-center justify-between px-5 pt-5 pb-3">
          <h1 className="text-[17px] font-semibold tracking-tight">
            train<span className="text-[var(--red)]">●</span>scanner
          </h1>
          <span
            title={`${passport.trips} trips · ${fmtKg(passport.co2SavedG)} CO₂ saved vs flying`}
            className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[12px] text-[var(--muted)]"
          >
            🎟 {passport.stamps.length} · 🌱 {fmtKg(passport.co2SavedG)}
          </span>
        </header>

        {focus ? (
          <div className="px-4 pb-4">
            <StationCard
              station={focus}
              role={role}
              canInsert={trip.stops.length >= 2 && focusIndex < 0 && trip.stops.length < MAX_STOPS}
              onStart={thenUnfocus(() =>
                dispatch(trip.stops.length ? { type: 'setStop', index: 0, station: focus } : { type: 'pick', station: focus }),
              )}
              onGo={thenUnfocus(() =>
                dispatch(trip.stops.length < 2 ? { type: 'pick', station: focus } : { type: 'setStop', index: last, station: focus }),
              )}
              onAddStop={thenUnfocus(() => dispatch({ type: 'insertStop', index: last, station: focus }))}
              onClose={() => setFocus(null)}
            />
          </div>
        ) : (
          <>
            <StopsEditor trip={trip} dispatch={dispatch} onFocus={tapStation} />
            <OptionsPanel options={options} onChange={setOptions} />

            {(plans.length > 1 || slots.length > 0) && (
              <nav aria-label="Trip steps" className="mx-4 mt-4 flex gap-2 overflow-x-auto pb-1">
                {plans.flatMap((p, i) => {
                  const chip = (key: string, on: boolean, onClick: () => void, label: string) => (
                    <button
                      key={key}
                      type="button"
                      aria-current={on ? 'step' : undefined}
                      onClick={onClick}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] whitespace-nowrap ${on ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--card)]' : 'border-[var(--line)] text-[var(--muted)]'}`}
                    >
                      {label}
                    </button>
                  )
                  const seg = chip(
                    `seg-${i}`,
                    !staySlot && activeSeg === i,
                    () => openSeg(i),
                    `${trip.returnDate && i === plans.length - 1 ? '↩' : i + 1} · ${p.from.name} → ${p.to.name} · ${dayLabel(p.date)}${selected[i] ? ' ✓' : ''}`,
                  )
                  const stay = slots.find((s) => s.after === i)
                  return stay
                    ? [
                        seg,
                        chip(
                          `stay-${stay.key}`,
                          staySlot?.key === stay.key,
                          () => setActiveStay(stay.key),
                          `🛏 ${stay.station.name} · ${stay.nights} night${stay.nights > 1 ? 's' : ''}${staySel[stay.key] ? ' ✓' : ''}`,
                        ),
                      ]
                    : [seg]
                })}
              </nav>
            )}

            {landed && segment && !staySlot && (
              <nav className="mx-4 mt-3 grid grid-cols-4 rounded-xl bg-[var(--hover)] p-1 text-[13px]">
                {SORTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSort(s)}
                    className={`rounded-lg py-1.5 capitalize transition-colors ${sort === s ? 'bg-[var(--card)] font-medium shadow-sm' : 'text-[var(--muted)]'}`}
                  >
                    {s}
                  </button>
                ))}
              </nav>
            )}

            <section className="mt-3 px-4 pb-4">
              {loading && (
                <>
                  {reducedMotion && (
                    <p className="mb-2 text-[13px] text-[var(--muted)]">
                      Searching {plans.length} segment{plans.length > 1 ? 's' : ''}…
                    </p>
                  )}
                  <ul className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <li key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--hover)]" />
                    ))}
                  </ul>
                </>
              )}
              {status === 'error' && (
                <div className="rounded-xl bg-[var(--red-soft)] p-3 text-[13px] text-[var(--red)]">
                  <p>{error}</p>
                  <button type="button" onClick={() => setRetry((n) => n + 1)} className="mt-2 font-medium underline">
                    Retry
                  </button>
                </div>
              )}
              {status === 'idle' && (
                <div className="px-1 pt-3 text-[14px] leading-relaxed text-[var(--muted)]">
                  <p>Where to?</p>
                  <p className="mt-1">Type two stations, or tap the red dots on the map. We compare every operator and combine them into one ticket.</p>
                </div>
              )}
              {staySlot && (
                <StayList
                  offers={stayOffers[staySlot.key]}
                  selected={staySel[staySlot.key] ?? null}
                  onSelect={(id) => setStaySel((s) => ({ ...s, [staySlot.key]: id }))}
                />
              )}
              {landed && status === 'done' && !staySlot && (
                <ul className="space-y-2">
                  {journeys.map((j) => (
                    <JourneyCard
                      key={j.id}
                      j={j}
                      active={(hovered ?? activeSelected) === j.id}
                      open={activeSelected === j.id}
                      onHover={setHovered}
                      onClick={() => choose(activeSeg, j.id)}
                      onBook={() => chooseAndAdvance(j.id)}
                      booking={false}
                      actionLabel="Choose this train"
                    />
                  ))}
                </ul>
              )}
            </section>

            {landed && status === 'done' && (
              <footer className="sticky bottom-0 border-t border-[var(--line)] bg-[var(--card)] px-4 py-3">
                {basketError && <p className="mb-2 rounded-xl bg-[var(--red-soft)] p-2 text-[13px] text-[var(--red)]">{basketError}</p>}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px]">
                    <div className="text-[18px] font-semibold tracking-tight">{total ? fmtPrice(total.total_cents, total.currency) : '…'}</div>
                    {total && (
                      <div className="text-[var(--muted)]">
                        {total.journeys.length} ticket{total.journeys.length > 1 ? 's' : ''}
                        {total.stays.length ? ` + ${total.stays.length} stay${total.stays.length > 1 ? 's' : ''}` : ''} · 🌱{' '}
                        {fmtKg(Math.max(0, total.co2_plane_g - total.co2_g))} saved
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={!total || booking}
                    onClick={book}
                    className="rounded-xl bg-[var(--ink)] px-5 py-3 text-[15px] font-medium text-[var(--card)] disabled:opacity-40"
                  >
                    {plans.length > 1 ? 'Book trip' : 'Book all tickets'}
                  </button>
                </div>
              </footer>
            )}
          </>
        )}
      </Sheet>

      {arrived && (
        <div className="absolute inset-0 grid place-items-center bg-black/20 backdrop-blur-[2px]">
          <div className="pop w-[340px] rounded-3xl bg-[var(--card)] p-6 text-center shadow-2xl">
            <div className="mx-auto grid size-20 rotate-[-8deg] place-items-center rounded-full border-2 border-dashed border-[var(--red)] text-[11px] font-semibold tracking-widest text-[var(--red)] uppercase">
              {arrived.legs[arrived.legs.length - 1].destination.name.split(/[ -]/)[0]}
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">Bon voyage!</h2>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              Your tickets are booked. You keep {fmtKg(Math.max(0, arrived.co2_plane_g - arrived.co2_g))} of CO₂ out of the sky.
            </p>
            <p className="mt-3 text-[13px]">
              Passport: <b>{passport.stamps.length}</b> stamps · <b>{fmtKg(passport.co2SavedG)}</b> saved
            </p>
            <button
              type="button"
              onClick={() => setArrived(null)}
              className="mt-5 w-full rounded-xl bg-[var(--ink)] py-3 text-[15px] font-medium text-[var(--card)]"
            >
              Plan another trip
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
