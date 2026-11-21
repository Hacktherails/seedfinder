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
    out.push({ from: trip.stops[i].station, to: trip.stops[i + 1].station, date })
  }
  if (trip.returnDate && trip.stops.length >= 2)
    out.push({ from: trip.stops.at(-1)!.station, to: trip.stops[0].station, date: trip.returnDate })
  return out
}
