import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Calendar, Clock3, Compass, Leaf, ShieldCheck, Sparkles, Train } from 'lucide-react'
import { api } from './api/client'
import type { Journey, JourneySearch, Network, Station } from './api/types'
import { fmtKg, tomorrow } from './format'
import TrainMap from './map/TrainMap'
import JourneyCard from './panel/JourneyCard'
import StationInput from './panel/StationInput'
import { load, save, type Passport } from './storage'

const PANEL_W = 400
type Sort = 'best' | 'cheapest' | 'fastest' | 'greenest'
const SORTS: Sort[] = ['best', 'cheapest', 'fastest', 'greenest']

interface PlannerSeed {
  fromName: string
  toName: string
  date: string
}

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

interface PlannerPageProps {
  seed: PlannerSeed | null
}

function PlannerPage({ seed }: PlannerPageProps) {
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

  const restoring = useRef(false)
  const seeded = useRef(false)

  useEffect(() => {
    api.network().then(setNetwork, () => { })
  }, [])

  // Prefill planner when coming from the landing quick planner.
  useEffect(() => {
    if (!network || !seed || seeded.current) return
    const byName = (name: string) =>
      network.hubs.find((h) => h.name.toLowerCase() === name.trim().toLowerCase()) ?? null
    const nextFrom = byName(seed.fromName)
    const nextTo = byName(seed.toName)
    setDate(seed.date)
    setFrom(nextFrom)
    setTo(nextTo)
    seeded.current = true
  }, [network, seed])

  // Back from Stripe: replay the booked journey as a ride, then stamp the passport
  useEffect(() => {
    const paid = new URLSearchParams(location.search).get('paid')
    const pending = load<{ search: JourneySearch; id: string } | null>('pending', null, 'session')
    if (!paid || !pending || pending.id !== paid) return
    history.replaceState(null, '', '/')
    const j = pending.search.journeys.find((x) => x.id === paid)
    if (!j) return
    restoring.current = true
    setFrom(pending.search.origin)
    setTo(pending.search.destination)
    setResult({ ...pending.search, journeys: [j] })
    setSelected(j.id)
    setTimeout(() => setRide(j), 1800)
  }, [])

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

  const book = async (j: Journey) => {
    if (!result) return
    setBooking(true)
    try {
      save('pending', { search: result, id: j.id }, 'session')
      const { url } = await api.checkout(j.id)
      location.href = url
    } catch (e) {
      setError((e as Error).message)
      setBooking(false)
    }
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
          <span
            title={`${passport.trips} trips · ${fmtKg(passport.co2SavedG)} CO₂ saved vs flying`}
            className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[12px] text-[var(--muted)]"
          >
            🎟 {passport.stamps.length} · 🌱 {fmtKg(passport.co2SavedG)}
          </span>
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
                  onBook={() => book(j)}
                  booking={booking}
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
            onClick={onPlan}
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
              onClick={onPlan}
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
                      onClick={onPlan}
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
              onClick={onPlan}
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
