import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ArrowRight, Calendar, Clock3, Compass, Leaf, ShieldCheck, Sparkles, Train } from 'lucide-react'
import { api } from './api/client'
import type { Account, Basket, Journey, JourneySearch, LngLat, Network, Order, Quote, Station } from './api/types'
import { fmtKg, fmtPrice, tomorrow } from './format'
import { greatCircle, journeyPath } from './map/geo'
import TrainMap from './map/TrainMap'
import AccountChip from './panel/AccountChip'
import CheckoutModal from './panel/CheckoutModal'
import JourneyCard from './panel/JourneyCard'
import Sheet, { type Snap } from './panel/Sheet'
import StationCard from './panel/StationCard'
import StopsEditor from './panel/StopsEditor'
import { load, save, type Passport } from './storage'
import { canEmbedCheckout } from './stripe'
import { initialTrip, MAX_STOPS, segmentPlans, tripReducer } from './trip'

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
}

function PlannerPage({ seed }: PlannerPageProps) {

  const [network, setNetwork] = useState<Network | null>(null)
  const [trip, dispatch] = useReducer(tripReducer, undefined, initialTrip)
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
  // ECO points (demo account: email only)
  const [account, setAccountState] = useState<Account | null>(() => load<Account | null>('account', null))
  const [usePoints, setUsePoints] = useState(true)
  const [order, setOrder] = useState<Order | null>(null)
  const [embedded, setEmbedded] = useState<{ clientSecret: string; orderId: string; quote: Quote } | null>(null)
  const pendingEmbed = useRef<{ clientSecret: string; orderId: string; quote: Quote } | null>(null)

  const setAccount = useCallback((a: Account | null) => {
    setAccountState(a)
    save('account', a)
  }, [])

  // Refresh the ECO balance of a remembered account
  useEffect(() => {
    const id = load<Account | null>('account', null)?.id
    if (id) api.account(id).then(setAccount, () => setAccount(null))
  }, [setAccount])

  // The server asks Stripe whether the order is paid, then credits the earned ECO points (idempotent).
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
    api.network().then(setNetwork, () => {})
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
      history.replaceState(null, '', '/')
      api.cancelOrder(cancelled).then((o) => o.account && setAccount(o.account), () => {})
      return
    }
    const paid = params.get('paid')
    const orderId = params.get('order')
    const pending = load<{ searches: JourneySearch[]; ids: string[] } | null>('pending', null, 'session')
    if (!paid || !pending || pending.ids.join(',') !== paid) return
    history.replaceState(null, '', '/')
    if (orderId) void confirmOrder(orderId)
    celebrate(pending)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on load
  }, [confirmOrder, setAccount])

  const plans = segmentPlans(trip)
  const planKey = plans.map((p) => `${p.from.id}>${p.to.id}@${p.date}`).join('|')

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
      Promise.all(plans.map((p) => api.journeys(p.from.id, p.to.id, p.date, ctrl.signal))).then(
        (r) => {
          setSearches(r)
          setActiveSeg(0)
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

  const ids = searches.map((_, i) => selected[i])
  const basketKey = ids.length && ids.every(Boolean) ? ids.join(',') : ''
  const accountId = account?.id ?? null
  const balance = account?.points ?? 0
  useEffect(() => {
    setBasketError(null)
    if (!basketKey) return
    let stale = false
    api.basket({ journey_ids: basketKey.split(','), account_id: accountId, use_points: usePoints }).then(
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
    const next = searches.findIndex((_, i) => i !== activeSeg && !selected[i])
    if (next >= 0) setActiveSeg(next)
  }

  const book = () => {
    const picked = basketKey.split(',')
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
      .then((embed) => api.checkout({ journey_ids: picked, account_id: accountId, use_points: useThem, embedded: embed }))
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

      <Sheet snap={snap} onSnapChange={setSnap} label="Trip planner">
        <header className="flex items-center justify-between px-5 pt-5 pb-3">
          <h1 className="text-[17px] font-semibold tracking-tight">
            train<span className="text-[var(--red)]">●</span>scanner
          </h1>
          <div className="flex items-center gap-1.5">
            <span
              title={`${passport.trips} trips · ${fmtKg(passport.co2SavedG)} CO₂ saved vs flying`}
              className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[12px] text-[var(--muted)]"
            >
              🎟 {passport.stamps.length} · 🌱 {fmtKg(passport.co2SavedG)}
            </span>
            <AccountChip account={account} onChange={setAccount} />
          </div>
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

            {plans.length > 1 && (
              <nav className="mx-4 mt-3 flex gap-2 overflow-x-auto pb-1">
                {plans.map((p, i) => (
                  <button
                    key={`${p.from.id}>${p.to.id}@${p.date}`}
                    type="button"
                    onClick={() => setActiveSeg(i)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] whitespace-nowrap ${activeSeg === i ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--card)]' : 'border-[var(--line)] text-[var(--muted)]'}`}
                  >
                    {trip.returnDate && i === plans.length - 1 ? '↩ Return' : i + 1} · {p.from.name} → {p.to.name} · {dayLabel(p.date)}
                    {selected[i] ? ' ✓' : ''}
                  </button>
                ))}
              </nav>
            )}

            {landed && segment && (
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
              {landed && status === 'done' && (
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
                    {total && <div className="text-[var(--muted)]">You keep {fmtKg(Math.max(0, total.co2_plane_g - total.co2_g))} CO₂ out of the sky</div>}
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
            <div className="mx-auto grid size-20 rotate-[-8deg] place-items-center rounded-full border-2 border-dashed border-[var(--red)] text-[11px] font-semibold tracking-widest text-[var(--red)] uppercase">
              {arrived.city.split(/[ -]/)[0]}
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">Bon voyage!</h2>
            <p className="mt-1 text-[14px] text-[var(--muted)]">
              Your tickets are booked. You keep {fmtKg(arrived.savedG)} of CO₂ out of the sky.
            </p>
            {order?.status === 'paid' && order.account && (
              <div className="mt-4 rounded-2xl bg-[var(--green-soft)] p-3 text-[var(--green)]">
                <p className="text-2xl font-semibold tracking-tight">+{order.points_earned} ECO</p>
                <p className="text-[12px]">
                  {order.points_used > 0 && <>{order.points_used} points spent · </>}
                  balance <b>{order.account.points.toLocaleString('en')}</b> points
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

/** ECO points line of the basket footer. Every figure comes from the API quote. */
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
      <p className="mb-2 rounded-xl bg-[var(--green-soft)] px-3 py-2 text-[12px] text-[var(--green)]">
        🌿 Sign in to earn <b>+{earnable} ECO points</b> on this trip and spend them on your next green ticket.
      </p>
    ) : null
  if (!q.points_earned && !q.max_points) return null
  return (
    <div className="mb-2 rounded-xl bg-[var(--green-soft)] px-3 py-2 text-[12px] text-[var(--green)]">
      {q.max_points > 0 && (
        <label className="flex cursor-pointer items-center justify-between gap-3 text-[13px]">
          <span>
            Use <b>{usePoints ? q.points_used : q.max_points}</b> of your {q.balance} ECO points
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
      {q.points_earned > 0 && <p className={q.max_points > 0 ? 'mt-1' : ''}>🌿 You earn +{q.points_earned} ECO points with this trip</p>}
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
    title: "L'Axe Imperial d'Europe Centrale",
    stops: ['Bruxelles-Midi', 'Berlin Hbf', 'Praha hl.n.', 'Wien Hbf'],
    days: 7,
    priceFrom: 145,
    image: 'https://images.unsplash.com/photo-1541849546-216549ae216d?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 2,
    title: 'Traversee Alpine du Saint-Gothard',
    stops: ['Paris Nord', 'Zurich HB', 'Milano Centrale'],
    days: 4,
    priceFrom: 129,
    image: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 3,
    title: 'Cap vers les Capitales Nordiques',
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
    <div className="min-h-full bg-[var(--card)] text-[var(--ink)] antialiased">
      <header className="sticky top-0 z-30 border-b border-[var(--line)]/80 bg-[var(--card)]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-[var(--ink)] text-[var(--card)]">
              <Train className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Train Scanner</span>
          </div>
          <button
            type="button"
            onClick={() => onPlan()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--ink)] px-4 text-sm font-medium text-[var(--card)] transition hover:opacity-90"
          >
            Planifier
            <ArrowRight className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pt-12 pb-16 sm:px-8 sm:pt-16 sm:pb-20">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-[radial-gradient(circle_at_12%_12%,var(--red-soft),transparent_38%),radial-gradient(circle_at_88%_8%,var(--green-soft),transparent_32%),linear-gradient(180deg,var(--card),#f6f2eb)] px-6 py-12 sm:px-10 sm:py-16">
          <p className="inline-flex items-center rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
            Europe Rail Planner
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            Trace ton itineraire ferroviaire en Europe.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Recherche multi-opérateurs, comparaison prix/temps/CO₂, puis réservation en un paiement. Une expérience claire de l'idée au billet.
          </p>

          <form onSubmit={submitQuickPlan} className="mt-8 rounded-2xl border border-[var(--line)] bg-white/80 p-4 backdrop-blur-sm sm:p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Planificateur rapide</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className="text-xs text-[var(--muted)]">
                Depart
                <input
                  list="home-stations"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
                  required
                />
              </label>
              <label className="text-xs text-[var(--muted)]">
                Arrivee
                <input
                  list="home-stations"
                  value={toName}
                  onChange={(e) => setToName(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
                  required
                />
              </label>
              <label className="text-xs text-[var(--muted)]">
                Date
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
                  required
                />
              </label>
              <button
                type="submit"
                className="mt-[19px] inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 text-sm font-medium text-[var(--card)] transition hover:opacity-90"
              >
                Planifier
                <ArrowRight className="size-4" />
              </button>
            </div>
            <datalist id="home-stations">
              {HOME_STATIONS.map((station) => (
                <option key={station} value={station} />
              ))}
            </datalist>
            <p className="mt-3 text-sm text-[var(--muted)]">Compatible mobile et desktop, carte live incluse.</p>
          </form>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-[var(--muted)]">
              <Compass className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Fluidité</span>
            </div>
            <h2 className="text-sm font-semibold">Correspondances optimisées</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">Assemble plusieurs étapes tout en gardant une vue claire des changements.</p>
          </article>

          <article className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-[var(--muted)]">
              <Sparkles className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Réseau</span>
            </div>
            <h2 className="text-sm font-semibold">Opérateurs européens réunis</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">Eurostar, ICE, TGV, ÖBB, SBB et plus, dans un même flow de recherche.</p>
          </article>

          <article className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-[var(--muted)]">
              <ShieldCheck className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Confiance</span>
            </div>
            <h2 className="text-sm font-semibold">Checkout unifié</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">Passe de la comparaison à la réservation avec suivi CO₂ et paiement Stripe.</p>
          </article>
        </section>

        <section className="mt-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Itineraires suggeres</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Inspiration rapide avant de passer sur le planner complet.</p>
            </div>
            <button
              type="button"
              onClick={() => onPlan()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] px-4 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--hover)]"
            >
              Voir le planner
              <ArrowRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {CURATED_HOME_TRIPS.map((trip) => (
              <article key={trip.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
                <div className="aspect-[16/10] overflow-hidden bg-[var(--hover)]">
                  <img src={trip.image} alt={trip.title} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2 text-[11px] text-[var(--muted)]">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5">
                      <Calendar className="size-3" /> {trip.days} jours
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5">
                      <Clock3 className="size-3" /> {trip.stops.length} gares
                    </span>
                  </div>

                  <h3 className="text-base font-semibold leading-snug">{trip.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{trip.stops.join(' -> ')}</p>

                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-[var(--muted)]">Dès</span>
                      <span className="text-lg font-semibold text-[var(--green)]">{trip.priceFrom} EUR</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPlan()}
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-[var(--ink)] px-3 text-xs font-medium text-[var(--card)] transition hover:opacity-90"
                    >
                      Planifier
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-[var(--line)] bg-[var(--hover)]/70 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Prêt à composer un trajet multi-étapes ?</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Passe sur la page planificateur existante pour accéder à la carte et au checkout.</p>
            </div>
            <button
              type="button"
              onClick={() => onPlan()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 text-sm font-medium text-[var(--card)] transition hover:opacity-90"
            >
              <Leaf className="size-4" />
              Ouvrir le planificateur
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<'home' | 'planner'>(() =>
    new URLSearchParams(window.location.search).has('paid') ? 'planner' : 'home',
  )
  const [seed, setSeed] = useState<PlannerSeed | null>(null)

  if (view === 'home') {
    return <LandingPage onPlan={(nextSeed) => { setSeed(nextSeed ?? null); setView('planner') }} />
  }

  return <PlannerPage seed={seed} />
}
