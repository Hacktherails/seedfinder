// Hand-written mirror of apps/api/trainscanner/models.py (openapi-typescript conflicts with TS 7).
export interface Health {
  status: string
  offline_demo: boolean
  stripe_configured: boolean
}

export type LngLat = [number, number]

export interface Station {
  id: string
  name: string
  country?: string | null
  lat: number
  lon: number
}

export interface Stop {
  id?: string | null
  name: string
  lat: number
  lon: number
  time: string
  tz?: string | null
}

export interface Leg {
  mode: string
  operator: string | null
  line: string | null
  origin: Stop
  destination: Stop
  duration_s: number
  distance_km: number
  price_cents: number
  co2_g: number
  path: LngLat[]
}

export type Tag = 'cheapest' | 'fastest' | 'greenest'

export interface Journey {
  id: string
  departure: string
  arrival: string
  duration_s: number
  transfers: number
  price_cents: number
  currency: string
  co2_g: number
  co2_plane_g: number
  operators: string[]
  tags: Tag[]
  legs: Leg[]
}

export interface JourneySearch {
  origin: Station
  destination: Station
  journeys: Journey[]
}

export interface Corridor {
  origin: string
  destination: string
  path: LngLat[]
}

export interface Network {
  hubs: Station[]
  corridors: Corridor[]
}

export interface CheckoutResponse {
  url: string
  demo: boolean
}

export interface Basket {
  journeys: Journey[]
  total_cents: number
  currency: string
  co2_g: number
  co2_plane_g: number
}
