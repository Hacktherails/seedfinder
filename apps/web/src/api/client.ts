import type { Basket, CheckoutResponse, Health, JourneySearch, Network, Station } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

const qs = (params: Record<string, string>) => new URLSearchParams(params).toString()

export const api = {
  health: () => request<Health>('/api/health'),
  network: () => request<Network>('/api/network'),
  stations: (q: string, signal?: AbortSignal) => request<Station[]>(`/api/stations?${qs({ q })}`, { signal }),
  journeys: (from: string, to: string, date: string, signal?: AbortSignal) =>
    request<JourneySearch>(`/api/journeys?${qs({ from, to, date })}`, { signal }),
  basket: (journey_ids: string[]) =>
    request<Basket>('/api/basket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journey_ids }),
    }),
  checkout: (journey_ids: string[]) =>
    request<CheckoutResponse>('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journey_ids }),
    }),
}
