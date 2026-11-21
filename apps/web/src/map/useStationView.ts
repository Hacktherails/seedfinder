import { useEffect, useRef } from 'react'
import type { Map as MlMap } from 'maplibre-gl'
import type { Station } from '../api/types'

const ORBIT_DEG_PER_S = 4
const STOP_EVENTS = ['mousedown', 'touchstart', 'wheel', 'dragstart'] as const

/** Station view: pitched flyTo with a slow orbit, Escape to exit. The base's building-3d layer handles the buildings. */
export function useStationView(map: MlMap | null, focus: Station | null, onExit: () => void): void {
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit
  const wasFocused = useRef(false)

  // Escape only while a station is focused.
  useEffect(() => {
    if (!focus) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onExitRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus])

  useEffect(() => {
    if (!map) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let stopOrbit = () => {}

    if (focus) {
      wasFocused.current = true

      const bearing = Math.random() * 60 - 30
      const view = { center: [focus.lon, focus.lat] as [number, number], zoom: 16, pitch: 60, bearing }

      const startOrbit = () => {
        let last = performance.now()
        let current = bearing
        const tick = (now: number) => {
          current += (ORBIT_DEG_PER_S * (now - last)) / 1000
          last = now
          map.setBearing(current)
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        const canvas = map.getCanvasContainer()
        stopOrbit = () => {
          cancelAnimationFrame(raf)
          for (const ev of STOP_EVENTS) canvas.removeEventListener(ev, stopOrbit)
          map.off('dragstart', stopOrbit)
        }
        for (const ev of STOP_EVENTS) canvas.addEventListener(ev, stopOrbit, { passive: true })
        map.on('dragstart', stopOrbit)
      }

      if (reduced) {
        map.jumpTo(view)
      } else {
        map.flyTo({ ...view, duration: 2500, essential: false })
        map.once('moveend', startOrbit)
      }
      return () => {
        map.off('moveend', startOrbit)
        stopOrbit()
      }
    }

    if (wasFocused.current) {
      wasFocused.current = false
      const overview = { center: [7.5, 48.6] as [number, number], zoom: 4.7, pitch: 52, bearing: -12 }
      if (reduced) map.jumpTo(overview)
      else map.flyTo({ ...overview, duration: 2000 })
    }
  }, [map, focus])
}
