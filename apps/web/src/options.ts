// Trip options: who travels and how. Kept apart from the itinerary (where and when).
export interface Party {
  adults: number
  youths: number // 12–25
  seniors: number // 60+
  children: number // 4–11
}

export interface TripOptions {
  party: Party
  travelClass: 1 | 2
  maxTransfers: number // 4 = any
  anyStation: boolean // search every station of the departure and arrival cities
  stays: boolean // offer a stay wherever the trip spends nights
}

export const MAX_TRAVELLERS = 9

export const defaultOptions = (): TripOptions => ({
  party: { adults: 1, youths: 0, seniors: 0, children: 0 },
  travelClass: 2,
  maxTransfers: 4,
  anyStation: false,
  stays: true,
})

export const travellers = (p: Party) => p.adults + p.youths + p.seniors + p.children

export const PARTY_ROWS: { key: keyof Party; label: string; hint: string }[] = [
  { key: 'adults', label: 'Adults', hint: '26–59' },
  { key: 'youths', label: 'Youth', hint: '12–25 · −25%' },
  { key: 'seniors', label: 'Seniors', hint: '60+ · −30%' },
  { key: 'children', label: 'Children', hint: '4–11 · −50%' },
]

export const CHANGES: { value: number; label: string }[] = [
  { value: 4, label: 'Any' },
  { value: 1, label: '≤ 1' },
  { value: 0, label: 'Direct' },
]

export function summary(o: TripOptions): string {
  const n = travellers(o.party)
  const parts = [`${n} traveller${n > 1 ? 's' : ''}`, o.travelClass === 1 ? '1st class' : '2nd class']
  if (o.maxTransfers === 0) parts.push('direct only')
  else if (o.maxTransfers < 4) parts.push(`≤ ${o.maxTransfers} change`)
  if (o.anyStation) parts.push('all stations')
  if (o.stays) parts.push('stays')
  return parts.join(' · ')
}
