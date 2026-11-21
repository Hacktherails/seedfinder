import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api/client'
import type { Account, Journey, JourneySearch, Network, Order, Quote, Station } from './api/types'
import { fmtKg, tomorrow } from './format'
import TrainMap from './map/TrainMap'
import AccountChip from './panel/AccountChip'
import CheckoutModal from './panel/CheckoutModal'
import JourneyCard from './panel/JourneyCard'
import StationInput from './panel/StationInput'
import { load, save, type Passport } from './storage'
import { canEmbedCheckout } from './stripe'

const PANEL_W = 400
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

export default function App() {
  const [network, setNetwork] = useState<Network | null>(null)
  const [from, setFrom] = useState<Station | null>(null)
  const [to, setTo] = useState<Station | null>(null)
  const [date, setDate] = useState(tomorrow())
  const [result, setResult] = useState<JourneySearch | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('best')
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  const [ride, setRide] = useState<Journey | null>(null)
  const [arrived, setArrived] = useState<Journey | null>(null)
  const [passport, setPassport] = useState<Passport>(() => load('passport', { stamps: [], co2SavedG: 0, trips: 0 }))
  const [account, setAccountState] = useState<Account | null>(() => load<Account | null>('account', null))
  const [checkout, setCheckout] = useState<{ clientSecret: string; orderId: string; journey: Journey; quote: Quote } | null>(
    null,
  )
  const [order, setOrder] = useState<Order | null>(null)

  const setAccount = useCallback((a: Account | null) => {
    setAccountState(a)
    save('account', a)
  }, [])

  const restoring = useRef(false)

  useEffect(() => {
    api.network().then(setNetwork, () => {})
  }, [])

  // Refresh the ECO balance of a remembered (demo) account
  useEffect(() => {
    const id = load<Account | null>('account', null)?.id
    if (id) api.account(id).then(setAccount, () => setAccount(null))
  }, [setAccount])

  // The server asks Stripe whether the order is paid, then credits the earned ECO points.
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

  // Back from Stripe (hosted page or demo mode): confirm, replay the booked journey as a ride, stamp the passport
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
    const pending = load<{ search: JourneySearch; id: string } | null>('pending', null, 'session')
    if (!paid || !pending || pending.id !== paid) return
    history.replaceState(null, '', '/')
    if (orderId) void confirmOrder(orderId)
    const j = pending.search.journeys.find((x) => x.id === paid)
    if (!j) return
    restoring.current = true
    setFrom(pending.search.origin)
    setTo(pending.search.destination)
    setResult({ ...pending.search, journeys: [j] })
    setSelected(j.id)
    setTimeout(() => setRide(j), 1800)
  }, [confirmOrder, setAccount])

  // Search as soon as both ends are set
  useEffect(() => {
    if (!from || !to || from.id === to.id) return
    if (restoring.current) {
      restoring.current = false
      return
    }
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    setSelected(null)
    api.journeys(from.id, to.id, date, ctrl.signal).then(
      (r) => {
        setResult(r)
        setLoading(false)
      },
      (e: Error) => {
        if (ctrl.signal.aborted) return
        setError(e.message)
        setResult(null)
        setLoading(false)
      },
    )
    return () => ctrl.abort()
  }, [from, to, date])

  const journeys = useMemo(() => (result ? sortJourneys(result.journeys, sort) : []), [result, sort])

  const stations = useMemo(() => {
    const s = new Map<string, Station>()
    for (const h of network?.hubs ?? []) s.set(h.name, h)
    for (const j of result?.journeys ?? [])
      for (const l of j.legs)
        if (l.mode !== 'WALK')
          for (const p of [l.origin, l.destination]) s.set(p.name, { id: p.name, name: p.name, lat: p.lat, lon: p.lon })
    return [...s.values()]
  }, [network, result])

  const book = async (j: Journey, usePoints: boolean) => {
    if (!result) return
    setBooking(true)
    setOrder(null)
    try {
      save('pending', { search: result, id: j.id }, 'session')
      const r = await api.checkout({
        journey_id: j.id,
        account_id: account?.id ?? null,
        use_points: usePoints,
        embedded: await canEmbedCheckout(),
      })
      if (r.client_secret) {
        setCheckout({ clientSecret: r.client_secret, orderId: r.order_id, journey: j, quote: r.quote })
        setBooking(false)
        if (account) api.account(account.id).then(setAccount, () => {}) // points are now held
      } else if (r.url) {
        location.href = r.url
      }
    } catch (e) {
      setError((e as Error).message)
      setBooking(false)
    }
  }

  // Embedded Checkout: the payment succeeded inside the modal, no page reload
  const checkoutRef = useRef(checkout)
  useEffect(() => {
    checkoutRef.current = checkout
  }, [checkout])
  const onCheckoutComplete = useCallback(() => {
    const c = checkoutRef.current
    if (!c) return
    setTimeout(() => {
      setCheckout(null)
      void confirmOrder(c.orderId)
      setResult((r) => (r ? { ...r, journeys: [c.journey] } : r))
      setSelected(c.journey.id)
      setTimeout(() => setRide(c.journey), 1200)
    }, 1200) // let Stripe show its success tick
  }, [confirmOrder])

  const closeCheckout = () => {
    const c = checkout
    setCheckout(null)
    if (c) api.cancelOrder(c.orderId).then((o) => o.account && setAccount(o.account), () => {})
  }

  const endRide = () => {
    const j = ride
    setRide(null)
    if (!j) return
    const city = j.legs[j.legs.length - 1].destination.name
    const next: Passport = {
      stamps: [...new Set([...passport.stamps, city])],
      co2SavedG: passport.co2SavedG + Math.max(0, j.co2_plane_g - j.co2_g),
      trips: passport.trips + 1,
    }
    setPassport(next)
    save('passport', next)
    setArrived(j)
  }

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  return (
    <div className="relative h-full overflow-hidden">
      <TrainMap
        network={network}
        journeys={result?.journeys ?? []}
        activeId={hovered ?? selected}
        ride={ride}
        stations={stations}
        panelWidth={PANEL_W}
        onHover={setHovered}
        onSelect={setSelected}
        onStationClick={(s) => (!from || (from && to) ? (setFrom(s), setTo(null), setResult(null)) : setTo(s))}
        onRideEnd={endRide}
      />

      <aside
        style={{ width: PANEL_W }}
        className={`absolute top-3 bottom-3 left-3 flex max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl bg-[var(--card)] shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-transform duration-500 max-sm:top-auto max-sm:h-[58vh] ${ride ? '-translate-x-[110%]' : ''}`}
      >
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

        <div className="mx-4 rounded-2xl border border-[var(--line)]">
          <div className="relative">
            <StationInput label="From" dot="hollow" value={from} onChange={setFrom} autoFocus />
            <div className="mx-4 border-t border-[var(--line)]" />
            <StationInput label="To" dot="solid" value={to} onChange={setTo} />
            <button
              type="button"
              onClick={swap}
              aria-label="Swap"
              className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-[var(--line)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--ink)]"
            >
              ⇅
            </button>
          </div>
          <div className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-2.5 text-[13px]">
            <span className="text-[var(--muted)]">Date</span>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent font-mono outline-none"
            />
          </div>
        </div>

        {result && (
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

        <section className="mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {loading && (
            <ul className="space-y-2">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--hover)]" />
              ))}
            </ul>
          )}
          {!loading && error && <p className="rounded-xl bg-[var(--red-soft)] p-3 text-[13px] text-[var(--red)]">{error}</p>}
          {!loading && !result && !error && (
            <div className="px-1 pt-6 text-[14px] leading-relaxed text-[var(--muted)]">
              <p>Where to?</p>
              <p className="mt-1">Type two stations, or tap the red dots on the map. We compare every operator and combine them into one ticket.</p>
            </div>
          )}
          {!loading && result && (
            <ul className="space-y-2">
              {journeys.map((j) => (
                <JourneyCard
                  key={j.id}
                  j={j}
                  active={(hovered ?? selected) === j.id}
                  open={selected === j.id}
                  onHover={setHovered}
                  onClick={() => setSelected(selected === j.id ? null : j.id)}
                  onBook={(usePoints) => book(j, usePoints)}
                  booking={booking}
                  account={account}
                />
              ))}
            </ul>
          )}
        </section>
      </aside>

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

      {checkout && (
        <CheckoutModal
          clientSecret={checkout.clientSecret}
          quote={checkout.quote}
          onComplete={onCheckoutComplete}
          onClose={closeCheckout}
        />
      )}
    </div>
  )
}
