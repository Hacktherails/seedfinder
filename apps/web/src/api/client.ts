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
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

const qs = (params: Record<string, string>) => new URLSearchParams(params).toString()
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
  journeys: (from: string, to: string, date: string, signal?: AbortSignal) =>
    request<JourneySearch>(`/api/journeys?${qs({ from, to, date })}`, { signal }),
  signIn: (email: string) => post<Account>('/api/account', { email }),
  account: (id: string) => request<Account>(`/api/account/${encodeURIComponent(id)}`),
  ecoProgram: () => request<EcoProgram>('/api/eco/program'),
  /** Basket total and ECO quote (points earned / spendable), always computed by the API. */
  basket: (body: BasketRequest) => post<Basket>('/api/basket', body),
  checkout: (body: CheckoutRequest) => post<CheckoutResponse>('/api/checkout', body),
  confirmOrder: (id: string) => post<Order>(`/api/orders/${encodeURIComponent(id)}/confirm`),
  cancelOrder: (id: string) => post<Order>(`/api/orders/${encodeURIComponent(id)}/cancel`),
}
