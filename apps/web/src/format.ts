export const fmtTime = (iso: string, tz?: string | null) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz ?? undefined }).format(new Date(iso))

export const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}` : `${m} min`
}

export const fmtPrice = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(cents / 100)

export const fmtKg = (g: number) => (g >= 10000 ? `${Math.round(g / 1000)} kg` : `${(g / 1000).toFixed(1)} kg`)

export const tomorrow = () => {
  const d = new Date(Date.now() + 86400000)
  return d.toISOString().slice(0, 10)
}

/** Rough "is this mostly a nice train" label for a mode. */
export const modeLabel: Record<string, string> = {
  HIGHSPEED_RAIL: 'High-speed',
  LONG_DISTANCE: 'Intercity',
  NIGHT_RAIL: 'Night train',
  REGIONAL_FAST_RAIL: 'Regional express',
  REGIONAL_RAIL: 'Regional',
  SUBURBAN: 'Suburban',
  SUBWAY: 'Metro',
  TRAM: 'Tram',
  BUS: 'Bus',
  WALK: 'Walk',
}
