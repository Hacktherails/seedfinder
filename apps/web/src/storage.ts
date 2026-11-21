// Per-viewer conveniences only; every access may throw (private mode, blocked storage).
export function load<T>(key: string, fallback: T, store: 'local' | 'session' = 'local'): T {
  try {
    const raw = (store === 'local' ? localStorage : sessionStorage).getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown, store: 'local' | 'session' = 'local') {
  try {
    ;(store === 'local' ? localStorage : sessionStorage).setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export interface Passport {
  stamps: string[] // city names
  co2SavedG: number
  trips: number
}
