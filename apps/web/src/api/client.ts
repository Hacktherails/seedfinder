import type { Basket, CheckoutResponse, Health, JourneySearch, Network, Station, Stay } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
  ).toString()

export interface JourneyQuery {
  from: string
  to: string
  date: string
  max_transfers: number
  adults: number
  youths: number
  seniors: number
  children: number
  travel_class: 1 | 2
  from_near?: string // "lat,lon": search every station around it
  to_near?: string
}

export interface StayQuery {
  city: string
  lat: number
  lon: number
  checkin: string
  nights: number
  guests: number
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  health: () => request<Health>('/api/health'),
  network: () => request<Network>('/api/network'),
  stations: (q: string, signal?: AbortSignal) => request<Station[]>(`/api/stations?${qs({ q })}`, { signal }),
  journeys: (q: JourneyQuery, signal?: AbortSignal) =>
    request<JourneySearch>(`/api/journeys?${qs({ ...q })}`, { signal }),
  stays: (q: StayQuery, signal?: AbortSignal) => request<Stay[]>(`/api/stays?${qs({ ...q })}`, { signal }),
  basket: (journey_ids: string[], stay_ids: string[]) => post<Basket>('/api/basket', { journey_ids, stay_ids }),
  checkout: (journey_ids: string[], stay_ids: string[]) =>
    post<CheckoutResponse>('/api/checkout', { journey_ids, stay_ids }),
}
