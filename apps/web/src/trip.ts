// Multi-stop trip being built on the map or in the panel. Front computes dates and preview geometry only, never prices.
import type { Station } from './api/types'

export interface TripStop {
  station: Station
  nights: number // nights spent at this stopover; 0 = just changing trains
}

export interface Trip {
  stops: TripStop[] // origin, stopovers..., destination
  departDate: string // ISO date, departure from stops[0]
  returnDate: string | null // destination -> origin, optional
}

export type TripAction =
  | { type: 'pick'; station: Station } // origin, then destination, then replaces destination
  | { type: 'setStop'; index: number; station: Station | null } // null removes it
  | { type: 'insertStop'; index: number; station: Station }
  | { type: 'removeStop'; index: number }
  | { type: 'setNights'; index: number; nights: number }
  | { type: 'swapEnds' }
  | { type: 'setDepartDate'; date: string }
  | { type: 'setReturnDate'; date: string | null }
  | { type: 'moveStop'; from: number; to: number } // drag reorder, any stop
  | { type: 'reset' }

export const MAX_STOPS = 6

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const today = () => new Date().toISOString().slice(0, 10)

export const initialTrip = (): Trip => ({ stops: [], departDate: addDays(today(), 1), returnDate: null })

const same = (a: Station | undefined, b: Station) => !!a && a.id === b.id

export function tripReducer(trip: Trip, action: TripAction): Trip {
  const stops = trip.stops
  switch (action.type) {
    case 'pick': {
      if (stops.some((s) => same(s.station, action.station))) return trip
      const stop = { station: action.station, nights: 0 }
      return { ...trip, stops: stops.length < 2 ? [...stops, stop] : [...stops.slice(0, -1), stop] }
    }
    case 'setStop': {
      const { index, station } = action
      if (!station) return { ...trip, stops: stops.filter((_, i) => i !== index) }
      if (index >= stops.length) return tripReducer(trip, { type: 'pick', station })
      // Same station twice in a row makes an empty segment.
      if (same(stops[index - 1]?.station, station) || same(stops[index + 1]?.station, station)) return trip
      return { ...trip, stops: stops.map((s, i) => (i === index ? { ...s, station } : s)) }
    }
    case 'insertStop': {
      const { index, station } = action
      if (stops.length >= MAX_STOPS || index < 1 || index > stops.length - 1) return trip
      if (same(stops[index - 1].station, station) || same(stops[index].station, station)) return trip
      return { ...trip, stops: [...stops.slice(0, index), { station, nights: 1 }, ...stops.slice(index)] }
    }
    case 'removeStop':
      return { ...trip, stops: stops.filter((_, i) => i !== action.index) }
    case 'setNights':
      return {
        ...trip,
        stops: stops.map((s, i) => (i === action.index ? { ...s, nights: Math.max(0, Math.min(14, action.nights)) } : s)),
      }
    case 'swapEnds':
      return { ...trip, stops: [...stops].reverse() }
    case 'setDepartDate':
      return { ...trip, departDate: action.date }
    case 'setReturnDate':
      return { ...trip, returnDate: action.date }
    case 'moveStop': {
      const { from, to } = action
      if (from === to || from < 0 || to < 0 || from >= stops.length || to >= stops.length) return trip
      const next = [...stops]
      next.splice(to, 0, ...next.splice(from, 1))
      // Same station twice in a row makes an empty segment.
      if (next.some((s, i) => i > 0 && same(next[i - 1].station, s.station))) return trip
      // Ends never sleep; a stop dragged into the middle becomes a one-night stopover.
      const last = next.length - 1
      return { ...trip, stops: next.map((s, i) => ({ ...s, nights: i === 0 || i === last ? 0 : s.nights || 1 })) }
    }
    case 'reset':
      return initialTrip()
  }
}

export interface SegmentPlan {
  from: Station
  to: Station
  date: string
}

/** One segment per consecutive stop pair, plus destination -> origin when returnDate is set. */
export function segmentPlans(trip: Trip): SegmentPlan[] {
  const out: SegmentPlan[] = []
  let date = trip.departDate
  for (let i = 0; i < trip.stops.length - 1; i++) {
    if (i > 0) date = addDays(date, trip.stops[i].nights)
    const [from, to] = [trip.stops[i].station, trip.stops[i + 1].station]
    out.push({ from, to, date })
  }
  if (trip.returnDate && trip.stops.length >= 2) {
    const [from, to] = [trip.stops.at(-1)!.station, trip.stops[0].station]
    out.push({ from, to, date: trip.returnDate })
  }
  return out
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

export interface StaySlot {
  key: string
  station: Station
  checkin: string
  nights: number
  after: number // index of the segment that arrives here
}

/** Where the traveller sleeps: stopovers with nights, and the destination until the return. */
export function staySlots(trip: Trip, plans: SegmentPlan[]): StaySlot[] {
  const n = trip.stops.length
  const out: StaySlot[] = []
  const slot = (station: Station, checkin: string, nights: number, after: number) =>
    nights > 0 && out.push({ key: `${station.id}@${checkin}+${nights}`, station, checkin, nights, after })
  for (let i = 1; i < n - 1; i++) slot(trip.stops[i].station, plans[i - 1].date, trip.stops[i].nights, i - 1)
  if (trip.returnDate && n >= 2) slot(trip.stops[n - 1].station, plans[n - 2].date, daysBetween(plans[n - 2].date, trip.returnDate), n - 2)
  return out
}
