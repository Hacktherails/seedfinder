/** Low-poly train meshes for SimpleMeshLayer. Nose points to +x; extents are [-1, 1] on every axis (scaled per car). */
type V = [number, number, number]
interface Section {
  x: number
  w: number // half width
  top: number
  bot: number
}

function build(sections: Section[]) {
  const pos: number[] = []
  const nrm: number[] = []
  const idx: number[] = []
  const tri = (a: V, b: V, c: V) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    // The body is convex around the origin: flip any triangle whose normal points inward
    const out = n[0] * (a[0] + b[0] + c[0]) + n[1] * (a[1] + b[1] + c[1]) + n[2] * (a[2] + b[2] + c[2]) >= 0
    if (!out) [b, c, n] = [c, b, n.map((k) => -k)]
    const len = Math.hypot(n[0], n[1], n[2]) || 1
    for (const p of [a, b, c]) {
      idx.push(pos.length / 3)
      pos.push(...p)
      nrm.push(n[0] / len, n[1] / len, n[2] / len)
    }
  }
  // Cross-section: box with bevelled roof edges
  const ring = ({ x, w, top, bot }: Section): V[] => {
    const k = Math.max(bot + 0.1, top - 0.45)
    return [
      [x, -w, bot],
      [x, w, bot],
      [x, w, k],
      [x, 0.7 * w, top],
      [x, -0.7 * w, top],
      [x, -w, k],
    ]
  }
  const rings = sections.map(ring)
  for (let s = 0; s + 1 < rings.length; s++)
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6
      const [a, b, c, d] = [rings[s][i], rings[s][j], rings[s + 1][j], rings[s + 1][i]]
      tri(a, b, c)
      tri(a, c, d)
    }
  for (const r of [rings[0], rings[rings.length - 1]]) for (let i = 1; i < 5; i++) tri(r[0], r[i], r[i + 1])
  return {
    attributes: {
      positions: { size: 3, value: new Float32Array(pos) },
      normals: { size: 3, value: new Float32Array(nrm) },
    },
    indices: { size: 1, value: new Uint32Array(idx) },
  }
}

/** Passenger car: long box, bevelled roof. */
export const CAR = build([
  { x: -1, w: 1, top: 1, bot: -1 },
  { x: 1, w: 1, top: 1, bot: -1 },
])

/** Locomotive / power car with a sloped, tapered TGV-style nose. */
export const LOCO = build([
  { x: -1, w: 1, top: 1, bot: -1 },
  { x: 0.2, w: 1, top: 1, bot: -1 },
  { x: 0.5, w: 0.95, top: 0.85, bot: -1 },
  { x: 0.8, w: 0.78, top: 0.5, bot: -0.95 },
  { x: 1, w: 0.5, top: 0.15, bot: -0.8 },
])
