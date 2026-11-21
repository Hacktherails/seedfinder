import type {
  Account,
  Basket,
  BasketRequest,
  CheckoutRequest,
  CheckoutResponse,
  EcoProgram,
  Health,
  JourneySearch,
  Network,
  Order,
  PublicConfig,
  Station,
  Stay,
} from './types'

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

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

export const api = {
  health: () => request<Health>('/api/health'),
  config: () => request<PublicConfig>('/api/config'),
  network: () => request<Network>('/api/network'),
  stations: (q: string, signal?: AbortSignal) => request<Station[]>(`/api/stations?${qs({ q })}`, { signal }),
  journeys: (q: JourneyQuery, signal?: AbortSignal) =>
    request<JourneySearch>(`/api/journeys?${qs({ ...q })}`, { signal }),
  stays: (q: StayQuery, signal?: AbortSignal) => request<Stay[]>(`/api/stays?${qs({ ...q })}`, { signal }),
  signIn: (email: string) => post<Account>('/api/account', { email }),
  account: (id: string) => request<Account>(`/api/account/${encodeURIComponent(id)}`),
  ecoProgram: () => request<EcoProgram>('/api/eco/program'),
  /** Basket total and ECO quote (points earned / spendable), always computed by the API. */
  basket: (body: BasketRequest) => post<Basket>('/api/basket', body),
  checkout: (body: CheckoutRequest) => post<CheckoutResponse>('/api/checkout', body),
  confirmOrder: (id: string) => post<Order>(`/api/orders/${encodeURIComponent(id)}/confirm`),
  cancelOrder: (id: string) => post<Order>(`/api/orders/${encodeURIComponent(id)}/cancel`),
}
