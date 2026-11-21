import type { Journey, LngLat } from '../api/types'

/** Whole door-to-door path of a journey (transit legs only). */
export const journeyPath = (j: Journey): LngLat[] => j.legs.filter((l) => l.mode !== 'WALK').flatMap((l) => l.path)

const R = 6371

export function haversineKm(a: LngLat, b: LngLat): number {
  const toRad = Math.PI / 180
  const dLat = (b[1] - a[1]) * toRad
  const dLon = (b[0] - a[0]) * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** A path with cumulative distances, so we can place a train anywhere along it. */
export interface Track {
  path: LngLat[]
  cum: number[]
  length: number
}

export function makeTrack(path: LngLat[]): Track {
  const cum = [0]
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversineKm(path[i - 1], path[i]))
  return { path, cum, length: cum[cum.length - 1] }
}

/** Position + heading (degrees, counter-clockwise from east) at distance d km along the track. */
export function pointAt(t: Track, d: number): { pos: LngLat; yaw: number } {
  const { path, cum } = t
  const dist = Math.min(Math.max(d, 0), t.length)
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] <= dist) lo = mid
    else hi = mid
  }
  const a = path[lo]
  const b = path[hi] ?? a
  const seg = cum[hi] - cum[lo] || 1
  const f = (dist - cum[lo]) / seg
  const pos: LngLat = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180)
  const dy = b[1] - a[1]
  return { pos, yaw: (Math.atan2(dy, dx) * 180) / Math.PI }
}

export function bounds(paths: LngLat[][]): [LngLat, LngLat] {
  let w = 180
  let s = 90
  let e = -180
  let n = -90
  for (const p of paths)
    for (const [x, y] of p) {
      w = Math.min(w, x)
      e = Math.max(e, x)
      s = Math.min(s, y)
      n = Math.max(n, y)
    }
  return [
    [w, s],
    [e, n],
  ]
}

/** Ray-casting point-in-polygon on the outer ring. */
export function inRing(pt: LngLat, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
