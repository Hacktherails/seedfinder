import { MapboxOverlay } from '@deck.gl/mapbox'
import { ColumnLayer, PathLayer } from '@deck.gl/layers'
import { SimpleMeshLayer } from '@deck.gl/mesh-layers'
import { CubeGeometry } from '@luma.gl/engine'
import { type GeoJSONSource, Map as MlMap, NavigationControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useRef } from 'react'
import type { Journey, Network, Station } from '../api/types'
import { bounds, inRing, journeyPath, makeTrack, pointAt, type Track } from './geo'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'
const RED: [number, number, number] = [229, 50, 45]
const INK: [number, number, number] = [24, 24, 27]
const TRAIN_COLORS: [number, number, number][] = [RED, [31, 79, 224], [242, 183, 5], INK, [24, 160, 88]]
const CUBE = new CubeGeometry()

type RGB = [number, number, number]
interface Train {
  track: Track
  d: number
  dir: 1 | -1
  pxPerSec: number
  color: RGB
  group: 'idle' | string // journey id
}
interface Car {
  pos: [number, number, number]
  yaw: number
  color: RGB
  scale: [number, number, number]
}

/** Push a polygon out by ~0.5 m so the red station shell hides the white building underneath. */
function grow(poly: number[][][]): number[][][] {
  const ring = poly[0]
  const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length
  const cy = ring.reduce((a, p) => a + p[1], 0) / ring.length
  return poly.map((r) => r.map(([x, y]) => [x + Math.sign(x - cx) * 0.000007, y + Math.sign(y - cy) * 0.0000045]))
}

/** Metres per screen pixel at a latitude/zoom (MapLibre uses 512px tiles). */
const mpp = (lat: number, zoom: number) => (78271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom

interface Props {
  network: Network | null
  journeys: Journey[]
  activeId: string | null
  ride: Journey | null
  stations: Station[]
  panelWidth: number
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onStationClick: (s: Station) => void
  onRideEnd: () => void
}

export default function TrainMap(props: Props) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const live = useRef(props)
  useEffect(() => {
    live.current = props
  })

  const tracks = useMemo(
    () => ({
      corridors: (props.network?.corridors ?? []).map((c) => makeTrack(c.path)),
      journeys: props.journeys.map((j) => ({ id: j.id, track: makeTrack(journeyPath(j)) })),
    }),
    [props.network, props.journeys],
  )

  // The animation loop reads tracks through this ref (its closure is created once)
  const tracksRef = useRef(tracks)
  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

  // Trains are rebuilt only when the set of tracks changes; positions advance every frame.
  const trains = useRef<Train[]>([])
  useEffect(() => {
    const t: Train[] = []
    tracks.corridors.forEach((track, i) => {
      for (let k = 0; k < 2; k++)
        t.push({
          track,
          d: Math.random() * track.length,
          dir: k ? -1 : 1,
          pxPerSec: 22 + Math.random() * 18,
          color: TRAIN_COLORS[(i + k) % TRAIN_COLORS.length],
          group: 'idle',
        })
    })
    tracks.journeys.forEach(({ id, track }, i) => {
      t.push({ track, d: 0, dir: 1, pxPerSec: 45, color: TRAIN_COLORS[i % TRAIN_COLORS.length], group: id })
    })
    trains.current = t
  }, [tracks])

  // Map + overlay, once
  useEffect(() => {
    const map = new MlMap({
      container: el.current!,
      style: STYLE,
      center: [7.5, 48.6],
      zoom: 4.7,
      pitch: 52,
      bearing: -12,
      maxPitch: 75,
      attributionControl: { compact: true },
    })
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __map: MlMap }).__map = map
    const overlay = new MapboxOverlay({ interleaved: true, layers: [] })
    overlayRef.current = overlay
    map.addControl(overlay)
    map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')

    map.setPadding({ left: live.current.panelWidth, top: 0, right: 0, bottom: 0 })
    map.on('load', () => {
      map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.28, position: [1.4, 200, 35] })
      map.setLayoutProperty('building', 'visibility', 'none')
      const height = ['coalesce', ['get', 'render_height'], 8]
      map.addLayer({
        id: 'building-3d',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 12.5,
        paint: {
          'fill-extrusion-color': '#ffffff',
          'fill-extrusion-height': height as never,
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.95,
        },
      })
      map.addSource('station-buildings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'station-buildings',
        type: 'fill-extrusion',
        source: 'station-buildings',
        paint: {
          'fill-extrusion-color': '#e5322d',
          'fill-extrusion-height': ['+', height, 0.5] as never,
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 1,
        },
      })
    })

    // Paint the building under each station red (from the vector tiles themselves, no extra API)
    map.on('idle', () => {
      if (map.getZoom() < 12.5 || !map.getSource('station-buildings')) return
      const view = map.getBounds()
      const near = live.current.stations.filter((s) => view.contains([s.lon, s.lat]))
      const feats = near.length ? map.querySourceFeatures('openmaptiles', { sourceLayer: 'building' }) : []
      const hits: GeoJSON.Feature[] = []
      // Tiles merge neighbouring buildings into one MultiPolygon: test each part on its own
      for (const f of feats) {
        const g = f.geometry
        const parts: number[][][][] = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
        for (const poly of parts) {
          const ring = poly[0]
          const hit = near.some((s) => inRing([s.lon, s.lat], ring) || ring.some(([x, y]) => Math.abs(x - s.lon) < 0.0007 && Math.abs(y - s.lat) < 0.0005))
          if (hit) hits.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: grow(poly) }, properties: f.properties })
        }
      }
      ;(map.getSource('station-buildings') as GeoJSONSource).setData({ type: 'FeatureCollection', features: hits })
    })

    // Animation loop
    let raf = 0
    let last = performance.now()
    let rideStart = 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const p = live.current
      const tracks = tracksRef.current
      const zoom = map.getZoom()
      const lat = map.getCenter().lat
      const m = mpp(lat, zoom)
      const hasJourneys = p.journeys.length > 0
      const cars: Car[] = []
      const carPx = 7
      const dims = (alpha: number): [number, number, number] => [
        Math.max(carPx * m, 12) * alpha,
        Math.max(2.4 * m, 2) * alpha,
        Math.max(2.6 * m, 2.2) * alpha,
      ]

      const pushTrain = (track: Track, d: number, dir: number, color: RGB, size: number) => {
        const [hl, , hh] = dims(size)
        const gap = (hl * 2.25) / 1000 // km between car centres
        for (let k = 0; k < 3; k++) {
          const { pos, yaw } = pointAt(track, d - dir * k * gap)
          cars.push({ pos: [pos[0], pos[1], hh], yaw: dir > 0 ? yaw : yaw + 180, color, scale: dims(size) })
        }
      }

      if (p.ride) {
        const track = tracks.journeys.find((t) => t.id === p.ride!.id)?.track
        if (track) {
          if (!rideStart) rideStart = now
          const rideD = ((now - rideStart) / 14000) * track.length // ~14 s ride, whatever the frame rate
          const { pos, yaw } = pointAt(track, rideD)
          pushTrain(track, rideD, 1, INK, 1.4)
          map.jumpTo({ center: pos, bearing: 90 - yaw, zoom: 9.5, pitch: 62, padding: { left: 0, top: 0, right: 0, bottom: 0 } })
          if (rideD >= track.length) {
            rideStart = 0
            map.setPadding({ left: p.panelWidth, top: 0, right: 0, bottom: 0 })
            p.onRideEnd()
          }
        }
      } else {
        rideStart = 0
        for (const t of trains.current) {
          if (hasJourneys && t.group === 'idle') continue
          if (t.group === 'idle') {
            t.d += t.dir * dt * t.pxPerSec * (m / 1000)
            if (t.d > t.track.length) t.dir = -1
            if (t.d < 0) t.dir = 1
          } else {
            t.d = (t.d + dt * t.pxPerSec * (m / 1000)) % (t.track.length + 40 * (m / 1000))
          }
          const active = t.group === p.activeId
          const dimmed = p.activeId && t.group !== 'idle' && !active
          if (dimmed) continue
          pushTrain(t.track, t.d, t.dir, active ? INK : t.color, active ? 1.3 : 1)
        }
      }

      const stations = p.stations
      overlayRef.current?.setProps({
        layers: [
          new PathLayer({
            id: 'corridors',
            data: tracks.corridors,
            getPath: (t: Track) => t.path,
            getColor: [24, 24, 27, hasJourneys ? 30 : 110],
            widthUnits: 'pixels',
            getWidth: 2.5,
            capRounded: true,
            jointRounded: true,
            parameters: { depthCompare: 'always' },
            updateTriggers: { getColor: hasJourneys },
          }),
          new PathLayer({
            id: 'journeys',
            data: tracks.journeys,
            getPath: (t: { track: Track }) => t.track.path,
            getColor: (t: { id: string }) =>
              t.id === p.activeId ? [...RED, 255] : p.activeId ? [24, 24, 27, 40] : [24, 24, 27, 150],
            getWidth: (t: { id: string }) => (t.id === p.activeId ? 5 : 3),
            widthUnits: 'pixels',
            capRounded: true,
            jointRounded: true,
            parameters: { depthCompare: 'always' },
            pickable: !p.ride,
            onHover: (info) => p.onHover((info.object as { id: string } | undefined)?.id ?? null),
            onClick: (info) => info.object && p.onSelect((info.object as { id: string }).id),
            updateTriggers: { getColor: p.activeId, getWidth: p.activeId },
          }),
          new ColumnLayer<Station>({
            id: 'stations',
            data: stations,
            getPosition: (s) => [s.lon, s.lat],
            radiusUnits: 'pixels',
            radius: 4,
            diskResolution: 20,
            getElevation: Math.max(10 * m, 20),
            getFillColor: [...RED, 255],
            extruded: true,
            pickable: !p.ride,
            visible: zoom < 13.5,
            onClick: (info) => info.object && p.onStationClick(info.object),
            updateTriggers: { getElevation: Math.round(zoom * 4) },
          }),
          new SimpleMeshLayer<Car>({
            id: 'trains',
            data: cars,
            mesh: CUBE,
            getPosition: (c) => c.pos,
            getOrientation: (c) => [0, c.yaw, 0],
            getScale: (c) => c.scale,
            getColor: (c) => c.color,
            material: { ambient: 0.55, diffuse: 0.6, shininess: 12, specularColor: [255, 255, 255] },
          }),
        ],
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      map.remove()
    }
  }, [])

  // Frame the search results
  useEffect(() => {
    const map = mapRef.current
    if (!map || !props.journeys.length) return
    const cam = map.cameraForBounds(bounds(props.journeys.map(journeyPath)), {
      padding: { left: 60, right: 60, top: 80, bottom: 80 },
    })
    if (cam) map.flyTo({ ...cam, zoom: (cam.zoom ?? 5) - 0.2, pitch: 45, bearing: 0, duration: 1800 })
  }, [props.journeys, props.panelWidth])

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
    </div>
  )
}
