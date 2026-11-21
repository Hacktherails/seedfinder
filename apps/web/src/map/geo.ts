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

/** Straight-on-the-globe preview between two points (spherical interpolation). */
export function greatCircle(a: LngLat, b: LngLat, n = 48): LngLat[] {
  const rad = Math.PI / 180
  const vec = ([lon, lat]: LngLat) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)]
  const [p, q] = [vec(a), vec(b)]
  const w = Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])))
  if (w < 1e-9) return [a, b]
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const [ka, kb] = [Math.sin((1 - t) * w) / Math.sin(w), Math.sin(t * w) / Math.sin(w)]
    const [x, y, z] = [0, 1, 2].map((k) => ka * p[k] + kb * q[k])
    return [Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad] as LngLat
  })
}

/** A path with cumulative distances, so we can place a train anywhere along it. */
export interface Track {
  path: LngLat[]
  cum: number[]
  length: number
}

const STEP_KM = 0.5
const HEADING_KM = 1.5

/** Even ~0.5 km resample, then a few binomial passes: removes zig-zags (endpoints stay fixed). */
function smoothPath(path: LngLat[]): LngLat[] {
  if (path.length < 3) return path
  const raw = [0]
  for (let i = 1; i < path.length; i++) raw.push(raw[i - 1] + haversineKm(path[i - 1], path[i]))
  const n = Math.max(2, Math.ceil(raw[raw.length - 1] / STEP_KM) + 1)
  let pts: LngLat[] = []
  for (let k = 0, i = 1; k < n; k++) {
    const d = (k / (n - 1)) * raw[raw.length - 1]
    while (i < path.length - 1 && raw[i] < d) i++
    const f = Math.min(1, Math.max(0, (d - raw[i - 1]) / (raw[i] - raw[i - 1] || 1)))
    pts.push([path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f])
  }
  for (let pass = 0; pass < 8; pass++) {
    const prev = pts
    pts = prev.map((p, i) =>
      i === 0 || i === prev.length - 1
        ? p
        : [(prev[i - 1][0] + 2 * p[0] + prev[i + 1][0]) / 4, (prev[i - 1][1] + 2 * p[1] + prev[i + 1][1]) / 4],
    )
  }
  return pts
}

export function makeTrack(raw: LngLat[]): Track {
  const path = smoothPath(raw)
  const cum = [0]
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversineKm(path[i - 1], path[i]))
  return { path, cum, length: cum[cum.length - 1] }
}

function posAt(t: Track, d: number): LngLat {
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
  const f = (dist - cum[lo]) / (cum[hi] - cum[lo] || 1)
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

/** Position + heading (degrees, counter-clockwise from east) at distance d km along the track; heading spans ±headingKm so it turns gradually. */
export function pointAt(t: Track, d: number, headingKm = HEADING_KM): { pos: LngLat; yaw: number } {
  const a = posAt(t, d - headingKm)
  const b = posAt(t, d + headingKm)
  const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180)
  return { pos: posAt(t, d), yaw: (Math.atan2(b[1] - a[1], dx) * 180) / Math.PI }
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
