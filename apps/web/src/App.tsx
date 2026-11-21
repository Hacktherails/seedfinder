import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ArrowRight, Calendar, Clock3, Compass, ShieldCheck, Sparkles, Train } from 'lucide-react'
import { api } from './api/client'
import type { Account, Basket, Journey, JourneySearch, LngLat, Network, Order, Quote, Station, Stay } from './api/types'
import { fmtKg, fmtPrice, tomorrow } from './format'
import { greatCircle, journeyPath } from './map/geo'
import TrainMap from './map/TrainMap'
import { defaultOptions, travellers, type TripOptions } from './options'
import CheckoutModal from './panel/CheckoutModal'
import JourneyCard from './panel/JourneyCard'
import OptionsPanel from './panel/OptionsPanel'
import Sheet, { type Snap } from './panel/Sheet'
import StationCard from './panel/StationCard'
import SeedWallet from './panel/SeedWallet'
import SeedIcon from './ui/SeedIcon'
import StayList from './panel/StayList'
import StopsEditor from './panel/StopsEditor'
import { load, save, type Passport } from './storage'
import { canEmbedCheckout } from './stripe'
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

type LoaderStatus = 'idle' | 'loading' | 'done' | 'error'

interface PlannerSeed {
  fromName: string
  toName: string
  date: string
}

interface PlannerPageProps {
  seed: PlannerSeed | null
  onHome: () => void
}

function PlannerPage({ seed, onHome }: PlannerPageProps) {

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
  const [checkoutRun, setCheckoutRun] = useState<{ stops: LngLat[]; onDone: () => void } | null>(null)
  const [arrived, setArrived] = useState<{ city: string; savedG: number } | null>(null)
  const [passport, setPassport] = useState<Passport>(() => load('passport', { stamps: [], co2SavedG: 0, trips: 0 }))
  const [isPhone, setIsPhone] = useState(() => !window.matchMedia('(min-width: 768px)').matches)
  const runDone = useRef(false)
  const checkoutUrl = useRef<string | null>(null)
  // Seeds (demo account: email only)
  const [account, setAccountState] = useState<Account | null>(() => load<Account | null>('account', null))
  const [usePoints, setUsePoints] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [embedded, setEmbedded] = useState<{ clientSecret: string; orderId: string; quote: Quote } | null>(null)
  const pendingEmbed = useRef<{ clientSecret: string; orderId: string; quote: Quote } | null>(null)

  const setAccount = useCallback((a: Account | null) => {
    setAccountState(a)
    save('account', a)
  }, [])

  // Refresh the seed balance of a remembered account
  useEffect(() => {
    const id = load<Account | null>('account', null)?.id
    if (id) api.account(id).then(setAccount, () => setAccount(null))
  }, [setAccount])

  // The server asks Stripe whether the order is paid, then credits the earned seeds (idempotent).
  const confirmOrder = useCallback(
    async (orderId: string) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const o = await api.confirmOrder(orderId)
          setOrder(o)
          if (o.account) setAccount(o.account)
          return
        } catch {
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
    },
    [setAccount],
  )

  useEffect(() => {
    api.network().then(setNetwork, () => { })
  }, [])

  const seeded = useRef(false)

  // Prefill the planner when entering it from the landing quick planner.
  useEffect(() => {
    if (!network || !seed || seeded.current) return
    const byName = (name: string) =>
      network.hubs.find((h) => h.name.toLowerCase() === name.trim().toLowerCase()) ?? null
    const from = byName(seed.fromName)
    const to = byName(seed.toName)
    if (!from || !to) return
    dispatch({ type: 'setDepartDate', date: seed.date })
    dispatch({ type: 'pick', station: from })
    dispatch({ type: 'pick', station: to })
    seeded.current = true
  }, [network, seed])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = () => setIsPhone(!mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Tickets paid: stamp the passport and say bon voyage
  const celebrate = (pending: { searches: JourneySearch[]; ids: string[] }) => {
    const js = pending.ids.map((id) => pending.searches.flatMap((s) => s.journeys).find((j) => j.id === id))
    if (js.some((j) => !j)) return
    const savedG = (js as Journey[]).reduce((a, j) => a + Math.max(0, j.co2_plane_g - j.co2_g), 0)
    setPassport((passport) => {
      const next: Passport = {
        stamps: [...new Set([...passport.stamps, ...pending.searches.flatMap((s) => [s.origin.name, s.destination.name])])],
        co2SavedG: passport.co2SavedG + savedG,
        trips: passport.trips + 1,
      }
      save('passport', next)
      return next
    })
    const s = pending.searches
    // Final destination: last segment, or the one before it when the last is the return to the origin.
    const isReturn = s.length > 1 && s.at(-1)!.destination.name === s[0].origin.name
    setArrived({ city: s.at(isReturn ? -2 : -1)!.destination.name, savedG })
  }

  // Back from Stripe's hosted page (or demo mode)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const cancelled = params.get('cancelled')
    if (cancelled) {
      history.replaceState(null, '', '/map')
      api.cancelOrder(cancelled).then((o) => o.account && setAccount(o.account), () => {})
      return
    }
    const paid = params.get('paid')
    const orderId = params.get('order')
    const pending = load<{ searches: JourneySearch[]; ids: string[] } | null>('pending', null, 'session')
    if (!paid || !pending || pending.ids.join(',') !== paid) return
    history.replaceState(null, '', '/map')
    if (orderId) void confirmOrder(orderId)
    celebrate(pending)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on load
  }, [confirmOrder, setAccount])

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
  const accountId = account?.id ?? null
  const balance = account?.points ?? 0
  useEffect(() => {
    setBasketError(null)
    if (!basketKey) return
    let stale = false
    const [js, ss] = basketKey.split(';').map((x) => x.split(',').filter(Boolean))
    api.basket({ journey_ids: js, stay_ids: ss, account_id: accountId, use_points: usePoints }).then(
      (data) => !stale && setBasket({ key: basketKey, data }),
      (e: Error) => !stale && setBasketError(e.message),
    )
    return () => {
      stale = true
    }
  }, [basketKey, accountId, balance, usePoints])
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

  const book = () => {
    const [picked, stays] = basketKey.split(';').map((x) => x.split(',').filter(Boolean))
    const stops: LngLat[] = trip.stops.map((s) => [s.station.lon, s.station.lat])
    if (trip.returnDate) stops.push(stops[0])
    setBooking(true)
    setBasketError(null)
    setOrder(null)
    save('pending', { searches, ids: picked }, 'session')
    runDone.current = !hasWebGL
    checkoutUrl.current = null
    pendingEmbed.current = null
    const go = () => {
      if (!runDone.current) return
      if (pendingEmbed.current) {
        setEmbedded(pendingEmbed.current) // Stripe Embedded Checkout, inside the app
        pendingEmbed.current = null
        setCheckoutRun(null)
        setBooking(false)
      } else if (checkoutUrl.current) location.href = checkoutUrl.current
    }
    if (hasWebGL) {
      setSnap('peek')
      setCheckoutRun({
        stops,
        onDone: () => {
          runDone.current = true
          go()
        },
      })
    }
    const useThem = usePoints && (total?.quote.max_points ?? 0) > 0
    canEmbedCheckout()
      .then((embed) => api.checkout({ journey_ids: picked, stay_ids: stays, account_id: accountId, use_points: useThem, embedded: embed }))
      .then(
      (r) => {
        if (r.client_secret) {
          pendingEmbed.current = { clientSecret: r.client_secret, orderId: r.order_id, quote: r.quote }
          if (accountId) api.account(accountId).then(setAccount, () => {}) // points are now held
        } else checkoutUrl.current = r.url ?? null
        go()
      },
      (e: Error) => {
        setBasketError(e.message)
        setCheckoutRun(null)
        setBooking(false)
      },
    )
  }

  // Embedded Checkout: paid inside the modal, no page reload
  const embeddedRef = useRef(embedded)
  useEffect(() => {
    embeddedRef.current = embedded
  }, [embedded])
  const onEmbeddedComplete = useCallback(() => {
    const e = embeddedRef.current
    if (!e) return
    setTimeout(() => {
      setEmbedded(null)
      void confirmOrder(e.orderId)
      const pending = load<{ searches: JourneySearch[]; ids: string[] } | null>('pending', null, 'session')
      if (pending) celebrate(pending)
    }, 1200) // let Stripe show its success tick
    // eslint-disable-next-line react-hooks/exhaustive-deps -- celebrate only uses state setters
  }, [confirmOrder])
  const closeEmbedded = () => {
    const e = embedded
    setEmbedded(null)
    if (e) api.cancelOrder(e.orderId).then((o) => o.account && setAccount(o.account), () => {})
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
          journeys={segment?.journeys ?? []}
          activeId={hovered ?? activeSelected}
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
          checkoutRun={checkoutRun}
        />
      )}

      <SeedWallet
        account={account}
        onChange={setAccount}
        earning={total ? total.journeys.reduce((a, j) => a + j.eco_points, 0) : 0}
      />

      <Sheet snap={snap} onSnapChange={setSnap} label="Trip planner">
        <header className="px-5 pt-5 pb-3">
          <h1 className="text-[17px] font-semibold tracking-tight">
            <button
              type="button"
              onClick={onHome}
              aria-label="Seedfinder, back to the home page"
              title="Back to the home page"
              className="-mx-1.5 flex items-center gap-1 rounded-lg px-1.5 py-0.5 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-[var(--green)] focus-visible:outline-none"
            >
              seed
              <SeedIcon className="size-6" />
              finder
            </button>
          </h1>
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
            {/* Itinerary + options: one green block, same radius as the panel (24 px − 8 px padding = 16 px cards) */}
            <div className="mx-3 rounded-3xl bg-[var(--green-soft)] p-2 shadow-[0_2px_12px_rgba(19,138,75,0.10)]">
              <StopsEditor trip={trip} dispatch={dispatch} onFocus={tapStation} />
              <OptionsPanel options={options} onChange={setOptions} />
            </div>

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
                  <p className="mt-1">Type two stations, or tap the green dots on the map. We compare every operator and combine them into one ticket.</p>
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
                      maxDuration={Math.max(...journeys.map((x) => x.duration_s))}
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
                {total && <EcoRow basket={total} signedIn={Boolean(account)} usePoints={usePoints} onToggle={setUsePoints} />}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px]">
                    <div className="text-[18px] font-semibold tracking-tight">
                      {total ? (
                        <>
                          {total.quote.discount_cents > 0 && (
                            <span className="mr-1.5 text-[13px] font-normal text-[var(--muted)] line-through">
                              {fmtPrice(total.total_cents, total.currency)}
                            </span>
                          )}
                          {fmtPrice(total.quote.total_cents, total.currency)}
                        </>
                      ) : (
                        '…'
                      )}
                    </div>
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
                    {booking ? 'Opening checkout…' : plans.length > 1 ? 'Book trip' : 'Book all tickets'}
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
            <div className="mx-auto grid size-20 rotate-[-8deg] place-items-center rounded-full border-2 border-dashed border-[var(--green)] text-[11px] font-semibold tracking-widest text-[var(--green)] uppercase">
              {arrived.city.split(/[ -]/)[0]}
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">Bon voyage! You planted a seed 🌱</h2>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              Your tickets are booked, and {fmtKg(arrived.savedG)} of CO₂ stays out of the sky.
            </p>
            {order?.status === 'paid' && order.account && (
              <div className="mt-4 rounded-2xl bg-[var(--green-soft)] p-3 text-[var(--green)]">
                <p className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight">
                  +{order.points_earned} <SeedIcon className="size-7" />
                </p>
                <p className="text-[12px]">
                  {order.points_used > 0 && <>{order.points_used} seeds spent · </>}
                  balance <b>{order.account.points.toLocaleString('en')}</b> seeds
                </p>
              </div>
            )}
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

      {embedded && (
        <CheckoutModal
          clientSecret={embedded.clientSecret}
          quote={embedded.quote}
          onComplete={onEmbeddedComplete}
          onClose={closeEmbedded}
        />
      )}
    </div>
  )
}

/** Seeds line of the basket footer. Every figure comes from the API quote. */
function EcoRow({
  basket,
  signedIn,
  usePoints,
  onToggle,
}: {
  basket: Basket
  signedIn: boolean
  usePoints: boolean
  onToggle: (v: boolean) => void
}) {
  const q = basket.quote
  const earnable = basket.journeys.reduce((a, j) => a + j.eco_points, 0)
  if (!signedIn)
    return earnable > 0 ? (
      <p className="mb-2 flex items-center gap-2 rounded-xl bg-[var(--green-soft)] px-3 py-2 text-[12px] text-[var(--green)]">
        <SeedIcon className="size-4" />
        <span>
          Sign in to earn <b>+{earnable} seeds</b> on this trip and spend them on your next green ticket.
        </span>
      </p>
    ) : null
  if (!q.points_earned && !q.max_points) return null
  return (
    <div className="mb-2 rounded-xl bg-[var(--green-soft)] px-3 py-2 text-[12px] text-[var(--green)]">
      {q.max_points > 0 && (
        <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
          <span>
            Use <b>{usePoints ? q.points_used : q.max_points}</b> of your {q.balance} seeds
            {usePoints && q.discount_cents > 0 && <b> · −{fmtPrice(q.discount_cents, q.currency)}</b>}
          </span>
          <input
            type="checkbox"
            checked={usePoints}
            onChange={(e) => onToggle(e.target.checked)}
            className="size-4 accent-[var(--green)]"
          />
        </label>
      )}
      {q.points_earned > 0 && (
        <p className={`flex items-center gap-1.5 ${q.max_points > 0 ? 'mt-1' : ''}`}>
          <SeedIcon className="size-4" /> You plant +{q.points_earned} seeds with this trip
        </p>
      )}
    </div>
  )
}

interface LandingProps {
  onPlan: (seed?: PlannerSeed) => void
}

interface CuratedTrip {
  id: number
  title: string
  stops: string[]
  days: number
  priceFrom: number
  image: string
}

const CURATED_HOME_TRIPS: CuratedTrip[] = [
  {
    id: 1,
    title: 'The Imperial Axis of Central Europe',
    stops: ['Bruxelles-Midi', 'Berlin Hbf', 'Praha hl.n.', 'Wien Hbf'],
    days: 7,
    priceFrom: 145,
    image: 'https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 2,
    title: 'Across the Alps via the Gotthard',
    stops: ['Paris Nord', 'Zurich HB', 'Milano Centrale'],
    days: 4,
    priceFrom: 129,
    image: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 3,
    title: 'Heading for the Nordic Capitals',
    stops: ['Amsterdam Centraal', 'Kobenhavn H', 'Stockholm Central'],
    days: 6,
    priceFrom: 168,
    image: 'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?auto=format&fit=crop&w=1200&q=80',
  },
]

const HOME_STATIONS = [
  'Bruxelles-Midi',
  'Paris Nord',
  'Amsterdam Centraal',
  'Berlin Hbf',
  'Zurich HB',
  'Praha hl.n.',
  'Wien Hbf',
  'Milano Centrale',
  'Kobenhavn H',
  'Stockholm Central',
  'London St Pancras',
  'Munchen Hbf',
]

// Same visual language as the planner: map-grey page, white 24 px cards with the panel shadow,
// light-green blocks holding 16 px white cards, small uppercase green labels, ink buttons.
const HOME_CARD = 'rounded-3xl bg-[var(--card)] shadow-[0_8px_40px_rgba(0,0,0,0.08)]'
const HOME_LABEL = 'text-[11px] font-semibold tracking-widest text-[var(--green)] uppercase'
const HOME_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] font-medium text-[var(--card)] transition-transform active:scale-[0.98]'
const HOME_INPUT = 'w-full bg-transparent text-[15px] text-[var(--ink)] outline-none'

function LandingPage({ onPlan }: LandingProps) {
  const [fromName, setFromName] = useState('Bruxelles-Midi')
  const [toName, setToName] = useState('Berlin Hbf')
  const [date, setDate] = useState(tomorrow())

  const submitQuickPlan = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!fromName.trim() || !toName.trim() || fromName === toName) return
    onPlan({
      fromName: fromName.trim(),
      toName: toName.trim(),
      date,
    })
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f2f3f0] text-[var(--ink)] antialiased">
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className={`${HOME_CARD} mx-auto flex h-14 max-w-6xl items-center justify-between pr-2 pl-5`}>
          <span className="flex items-center gap-1 text-[17px] font-semibold tracking-tight">
            seed
            <SeedIcon className="size-6" />
            finder
          </span>
          <button type="button" onClick={() => onPlan()} className={`${HOME_BTN} h-10 px-4 text-sm`}>
            Plan a trip
            <ArrowRight className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-3 pt-4 pb-16">
        {/* Hero: pitch on the left, the quick planner styled like the panel's itinerary block on the right */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className={`${HOME_CARD} flex flex-col justify-center p-6 sm:p-10`}>
            <p className={HOME_LABEL}>Trains across Europe, for the planet</p>
            <h1 className="mt-3 max-w-2xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
              Find your way.
              <br />
              <span className="text-[var(--green)]">Plant a seed.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--muted)] sm:text-base">
              Every train you take instead of a plane plants a seed for the planet. Search every operator, compare price, time and CO₂,
              and book it all in one payment.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[12px] font-medium">
              <span className="rounded-full bg-[var(--green-soft)] px-3 py-1 text-[var(--green)]">🌱 Up to −95 % CO₂ vs flying</span>
              <span className="rounded-full bg-[var(--hover)] px-3 py-1">One payment, every operator</span>
              <span className="rounded-full bg-[var(--hover)] px-3 py-1">Live map</span>
            </div>
          </div>

          <form onSubmit={submitQuickPlan} className="rounded-3xl bg-[var(--green-soft)] p-2 shadow-[0_8px_40px_rgba(19,138,75,0.12)]">
            <p className={`${HOME_LABEL} px-2 pt-1 pb-1.5`}>Quick planner</p>
            <div className="rounded-2xl bg-[var(--card)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <label className="flex items-center gap-3 px-4 py-3">
                <span className="size-2.5 shrink-0 rounded-full border-2 border-[var(--green)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-[var(--muted)]">From</span>
                  <input list="home-stations" value={fromName} onChange={(e) => setFromName(e.target.value)} className={HOME_INPUT} required />
                </span>
              </label>
              <div className="mx-4 border-t border-[var(--line)]" />
              <label className="flex items-center gap-3 px-4 py-3">
                <span className="size-2.5 shrink-0 rounded-full border-2 border-[var(--green)] bg-[var(--green)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-[var(--muted)]">To</span>
                  <input list="home-stations" value={toName} onChange={(e) => setToName(e.target.value)} className={HOME_INPUT} required />
                </span>
              </label>
              <label className="block border-t border-[var(--line)] px-4 py-3">
                <span className="block text-[11px] text-[var(--muted)]">Depart</span>
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  className={HOME_INPUT}
                  required
                />
              </label>
            </div>
            <button type="submit" className={`${HOME_BTN} mt-2 h-12 w-full text-[15px]`}>
              Find my route
              <ArrowRight className="size-4" />
            </button>
            <p className="px-2 pt-2 pb-1 text-[12px] text-[var(--green)]">Works on mobile and desktop, with a live map.</p>
            <datalist id="home-stations">
              {HOME_STATIONS.map((station) => (
                <option key={station} value={station} />
              ))}
            </datalist>
          </form>
        </section>

        {/* Seeds rewards */}
        <section className={`${HOME_CARD} grid grid-cols-1 gap-2 p-2 md:grid-cols-[1.1fr_0.9fr]`}>
          <div className="p-5 sm:p-8">
            <p className={HOME_LABEL}>Seeds, our climate rewards</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Every green ticket plants seeds.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
              You get 1 seed for every kg of CO₂ you keep out of the sky by taking the train instead of flying. Spend them on your
              next green ticket, and watch your impact grow from a seed into a forest.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <SeedIcon className="mt-0.5 size-4" />
                <span>The greener the route, the more seeds it plants.</span>
              </li>
              <li className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--green)]" />
                <span>Grow from 🌰 Seed to 🌱 Sprout, 🌿 Sapling, 🌳 Tree and 🌲 Forest.</span>
              </li>
            </ul>
            <button type="button" onClick={() => onPlan()} className={`${HOME_BTN} mt-6 h-11 px-5 text-sm`}>
              Start planting seeds
              <ArrowRight className="size-4" />
            </button>
          </div>
          <div className="grid min-h-[260px] place-items-center rounded-2xl bg-[var(--green-soft)] p-8">
            <img src="/ecoToken-512.png" alt="Seedfinder reward token: a train with a sprouting leaf" className="size-48 drop-shadow-[0_12px_24px_rgba(19,138,75,0.25)] sm:size-56" />
          </div>
        </section>

        {/* Why */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(
            [
              [Compass, '1 · Find', 'The greenest way there', 'Every operator in one search: Eurostar, ICE, TGV, ÖBB, SBB and more.'],
              [ShieldCheck, '2 · Ride', 'One checkout, every ticket', 'Combine several legs and book them all in a single Stripe payment.'],
              [Sparkles, '3 · Grow', 'Plant seeds as you travel', 'Each green trip plants seeds that grow your impact and pay for your next ticket.'],
            ] as const
          ).map(([Icon, label, title, text]) => (
            <article key={label} className={`${HOME_CARD} p-5`}>
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-[var(--green-soft)] text-[var(--green)]">
                  <Icon className="size-4" />
                </span>
                <span className={HOME_LABEL}>{label}</span>
              </div>
              <h2 className="mt-3 text-[15px] font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{text}</p>
            </article>
          ))}
        </section>

        {/* Suggested itineraries: stops drawn like the planner's journey details */}
        <section className="pt-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <p className={HOME_LABEL}>Inspiration</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Suggested itineraries</h2>
            </div>
            <button
              type="button"
              onClick={() => onPlan()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--card)] px-4 text-sm font-medium shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:bg-[var(--hover)]"
            >
              Open the planner
              <ArrowRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {CURATED_HOME_TRIPS.map((trip) => (
              <article key={trip.id} className={`${HOME_CARD} flex flex-col p-2`}>
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[var(--hover)]">
                  <img src={trip.image} alt={trip.title} className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute top-2 left-2 flex gap-1.5 text-[11px] font-medium">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--card)]/90 px-2 py-0.5 backdrop-blur">
                      <Calendar className="size-3" /> {trip.days} days
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--card)]/90 px-2 py-0.5 backdrop-blur">
                      <Clock3 className="size-3" /> {trip.stops.length} stations
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="text-base leading-snug font-semibold">{trip.title}</h3>
                  <ol className="mt-3 ml-1 space-y-1.5 border-l-2 border-[var(--green)] pl-3.5 text-[13px]">
                    {trip.stops.map((stop, i) => (
                      <li key={stop} className="relative">
                        <span
                          className={`absolute top-1 -left-[21px] size-2.5 rounded-full border-2 border-[var(--green)] ${i === 0 ? 'bg-[var(--card)]' : 'bg-[var(--green)]'}`}
                        />
                        {stop}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <div>
                      <span className="block text-[11px] text-[var(--muted)]">From</span>
                      <span className="text-lg font-semibold tracking-tight">€{trip.priceFrom}</span>
                    </div>
                    <button type="button" onClick={() => onPlan()} className={`${HOME_BTN} h-9 px-3 text-xs`}>
                      Plan
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="rounded-3xl bg-[var(--green-soft)] p-2">
          <div className="flex flex-col gap-4 rounded-2xl bg-[var(--card)] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[15px] font-semibold">Where will your next seed grow?</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Open the map, pick your stations, and let the train do the planting.</p>
            </div>
            <button type="button" onClick={() => onPlan()} className={`${HOME_BTN} h-11 px-5 text-sm`}>
              <Train className="size-4" />
              Open the planner
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

// Two pages: /home (landing) and /map (planner). '/' and unknown paths land on /home.
type View = 'home' | 'map'
const PATHS: Record<View, string> = { home: '/home', map: '/map' }

function viewFromUrl(): View {
  const { pathname, search } = window.location
  const params = new URLSearchParams(search)
  // Back from Stripe (older links point at '/?paid=…'): that flow lives on the map page
  const view: View = pathname === PATHS.map || params.has('paid') || params.has('cancelled') ? 'map' : 'home'
  if (pathname !== PATHS[view]) history.replaceState(null, '', PATHS[view] + search)
  return view
}

export default function App() {
  const [view, setView] = useState<View>(viewFromUrl)
  const [seed, setSeed] = useState<PlannerSeed | null>(null)

  // Browser back / forward between the two pages
  useEffect(() => {
    const onPop = () => setView(viewFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = (next: View) => {
    if (window.location.pathname !== PATHS[next]) history.pushState(null, '', PATHS[next])
    setView(next)
  }

  if (view === 'home') {
    return (
      <LandingPage
        onPlan={(nextSeed) => {
          setSeed(nextSeed ?? null)
          go('map')
        }}
      />
    )
  }

  return <PlannerPage seed={seed} onHome={() => go('home')} />
}
