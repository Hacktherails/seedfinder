// Hand-written mirror of apps/api/trainscanner/models.py (openapi-typescript conflicts with TS 7).
export interface Health {
  status: string
  offline_demo: boolean
  stripe_configured: boolean
}

export interface PublicConfig {
  stripe_publishable_key?: string | null
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
  green: boolean
  eco_points: number
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

export interface EcoProgram {
  point_value_cents: number
  grams_per_point: number
  commission_rate: number
  reward_budget_share: number
  max_discount_share: number
  min_redeem_points: number
  green_max_co2_ratio: number
  min_flight_km: number
}

export interface Account {
  id: string
  email: string
  points: number
  co2_saved_g: number
  trips: number
}

export interface Quote {
  journey_id: string
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  currency: string
  points_used: number
  points_earned: number
  max_points: number
  balance: number
}

export interface CheckoutRequest {
  journey_id: string
  account_id?: string | null
  use_points?: boolean
  embedded?: boolean
}

export interface CheckoutResponse {
  order_id: string
  url?: string | null
  client_secret?: string | null
  demo: boolean
  quote: Quote
}

export type OrderStatus = 'pending' | 'paid' | 'cancelled'

export interface Order {
  id: string
  journey_id: string
  status: OrderStatus
  points_used: number
  points_earned: number
  total_cents: number
  co2_saved_g: number
  account?: Account | null
}
