import { useEffect, useRef } from 'react'
import type { GeoJSONSource, Map as MlMap, MapMouseEvent, MapTouchEvent, PointLike } from 'maplibre-gl'
import type { Station } from '../api/types'
import type { TripStop } from '../trip'

interface Opts {
  stations: Station[]
  stops: TripStop[]
  onInsert(index: number, station: Station): void
  onReplace(index: number, station: Station): void
  onRemove(index: number): void
}

type Drag =
  | { mode: 'insert'; index: number } // index = insertion index (segment + 1)
  | { mode: 'replace'; index: number } // index of the dragged intermediate stop

const SRC = 'drag-ghost'
const LAYERS = ['drag-snap', 'drag-ghost-point', 'drag-ghost-line']
const SNAP_PX = 40
const LONG_PRESS_MS = 350
const MOVE_TOLERANCE_PX = 8
const INK = '#18181b'
const GREEN = '#16a34a' // same map green as TrainMap
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/** Drag the route onto a station to insert a stopover; drag a stopover to replace it or drop it in the void to remove it.
 * While a drag runs (and one tick after), `map.getCanvas().dataset.dragging === '1'` so click handlers can ignore it. */
export function useRouteDrag(map: MlMap | null, opts: Opts): void {
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    if (!map) return
    const canvas = map.getCanvas()

    map.addSource(SRC, { type: 'geojson', data: EMPTY })
    map.addLayer({
      id: 'drag-ghost-line',
      type: 'line',
      source: SRC,
      filter: ['==', ['get', 'kind'], 'line'],
      paint: { 'line-color': INK, 'line-width': 3, 'line-dasharray': [2, 2] },
    })
    map.addLayer({
      id: 'drag-snap',
      type: 'circle',
      source: SRC,
      filter: ['==', ['get', 'kind'], 'snap'],
      paint: { 'circle-radius': 16, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': GREEN, 'circle-stroke-width': 3 },
    })
    map.addLayer({
      id: 'drag-ghost-point',
      type: 'circle',
      source: SRC,
      filter: ['==', ['get', 'kind'], 'point'],
      paint: { 'circle-radius': 9, 'circle-color': INK, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
    })

    let drag: Drag | null = null
    let snapped: Station | null = null
    let timer = 0
    let pending: { drag: Drag; x: number; y: number } | null = null

    const hitLayers = () => ['route-hit', 'stations-circle'].filter((id) => map.getLayer(id))
    // Stops the ghost is connected to; their stations can't be snap targets.
    const anchors = (d: Drag): TripStop[] => {
      const s = optsRef.current.stops
      return d.mode === 'insert' ? [s[d.index - 1], s[d.index]] : [s[d.index - 1], s[d.index + 1]]
    }

    const draw = (lngLat: [number, number]) => {
      const features: object[] = [
        { type: 'Feature', properties: { kind: 'point' }, geometry: { type: 'Point', coordinates: lngLat } },
      ]
      for (const stop of anchors(drag!)) {
        if (stop)
          features.push({
            type: 'Feature',
            properties: { kind: 'line' },
            geometry: { type: 'LineString', coordinates: [[stop.station.lon, stop.station.lat], lngLat] },
          })
      }
      if (snapped)
        features.push({
          type: 'Feature',
          properties: { kind: 'snap' },
          geometry: { type: 'Point', coordinates: [snapped.lon, snapped.lat] },
        })
      map.getSource<GeoJSONSource>(SRC)?.setData({ type: 'FeatureCollection', features } as never)
    }

    const update = (e: MapMouseEvent | MapTouchEvent) => {
      if (!drag) return
      const excluded = new Set(anchors(drag).map((s) => s?.station.id))
      let best = SNAP_PX
      snapped = null
      for (const p of optsRef.current.stations) {
        if (excluded.has(p.id)) continue
        const pt = map.project([p.lon, p.lat])
        const dist = Math.hypot(pt.x - e.point.x, pt.y - e.point.y)
        if (dist <= best) {
          best = dist
          snapped = p
        }
      }
      draw([e.lngLat.lng, e.lngLat.lat])
    }

    const activate = (d: Drag) => {
      drag = d
      map.dragPan.disable()
      canvas.style.cursor = 'grabbing'
      canvas.dataset.dragging = '1'
    }

    const end = (commit: boolean) => {
      clearTimeout(timer)
      pending = null
      if (!drag) return
      const { onInsert, onReplace, onRemove } = optsRef.current
      const d = drag
      const target = snapped
      drag = null
      snapped = null
      map.dragPan.enable()
      canvas.style.cursor = ''
      map.getSource<GeoJSONSource>(SRC)?.setData(EMPTY as never)
      setTimeout(() => delete canvas.dataset.dragging, 50) // outlive the click that follows mouseup
      if (!commit) return
      if (d.mode === 'insert') {
        if (target) onInsert(d.index, target)
      } else if (target) onReplace(d.index, target)
      else onRemove(d.index)
    }

    const hit = (point: PointLike, pad: number): Drag | null => {
      const layers = hitLayers()
      if (!layers.length) return null
      const [x, y] = Array.isArray(point) ? point : [point.x, point.y]
      const features = map.queryRenderedFeatures(
        [
          [x - pad, y - pad],
          [x + pad, y + pad],
        ],
        { layers },
      )
      const stop = features.find((f) => f.layer.id === 'stations-circle' && f.properties?.role === 'stop')
      if (stop) return { mode: 'replace', index: Number(stop.properties.index) }
      const seg = features.find((f) => f.layer.id === 'route-hit' && Number(f.properties?.segment) >= 0)
      return seg ? { mode: 'insert', index: Number(seg.properties.segment) + 1 } : null
    }

    const onMouseDown = (e: MapMouseEvent) => {
      if (e.originalEvent.button !== 0) return
      const d = hit(e.point, 0)
      if (!d) return
      e.preventDefault() // stops drag-pan
      activate(d)
      update(e)
    }
    const onTouchStart = (e: MapTouchEvent) => {
      clearTimeout(timer)
      pending = null
      if (e.originalEvent.touches.length !== 1) return
      const d = hit(e.point, 12)
      if (!d) return
      pending = { drag: d, x: e.point.x, y: e.point.y }
      timer = window.setTimeout(() => {
        if (!pending) return
        navigator.vibrate?.(10)
        activate(pending.drag)
        pending = null
        update(e)
      }, LONG_PRESS_MS)
    }
    const onMouseMove = (e: MapMouseEvent) => {
      if (drag) return update(e)
      const layers = map.getLayer('route-hit') ? ['route-hit'] : []
      canvas.style.cursor = layers.length && map.queryRenderedFeatures(e.point, { layers }).length ? 'grab' : ''
    }
    const onTouchMove = (e: MapTouchEvent) => {
      if (drag) {
        e.preventDefault()
        return update(e)
      }
      if (
        pending &&
        (e.originalEvent.touches.length > 1 ||
          Math.hypot(e.point.x - pending.x, e.point.y - pending.y) > MOVE_TOLERANCE_PX)
      ) {
        clearTimeout(timer)
        pending = null
      }
    }
    const onUp = () => end(true)
    const onTouchCancel = () => end(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && end(false)

    map.on('mousedown', onMouseDown)
    map.on('touchstart', onTouchStart)
    map.on('mousemove', onMouseMove)
    map.on('touchmove', onTouchMove)
    // Release can happen outside the canvas, so end events live on window.
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    window.addEventListener('touchcancel', onTouchCancel)
    window.addEventListener('keydown', onKey)

    return () => {
      end(false)
      map.off('mousedown', onMouseDown)
      map.off('touchstart', onTouchStart)
      map.off('mousemove', onMouseMove)
      map.off('touchmove', onTouchMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
      window.removeEventListener('touchcancel', onTouchCancel)
      window.removeEventListener('keydown', onKey)
      for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(SRC)) map.removeSource(SRC)
    }
  }, [map])
}
