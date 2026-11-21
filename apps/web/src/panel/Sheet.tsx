import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'

export type Snap = 'peek' | 'half' | 'full'

const ORDER: Snap[] = ['peek', 'half', 'full']
const PEEK_PX = 150
const FULL_HEIGHT = 'calc(100dvh - 3rem - env(safe-area-inset-top))'
const FLICK_PX_PER_MS = 0.5
const TAP_SLOP_PX = 6

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = () => setDesktop(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return desktop
}

// Visible height in px of each snap, given the full-height container's pixel height.
const snapHeight = (snap: Snap, full: number) =>
  snap === 'peek' ? PEEK_PX : snap === 'half' ? Math.min(window.innerHeight / 2, full) : full

type Gesture = { startY: number; startVisible: number; full: number; lastY: number; lastT: number; v: number }

export default function Sheet(props: {
  snap: Snap
  onSnapChange: (s: Snap) => void
  label: string
  hidden?: boolean
  children: ReactNode
}) {
  const { snap, onSnapChange, label, hidden, children } = props
  const desktop = useIsDesktop()
  const boxRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  // Visible height in px while a finger/mouse is dragging, null otherwise.
  const [dragVisible, setDragVisible] = useState<number | null>(null)

  if (desktop) {
    return (
      <section
        role="region"
        aria-label={label}
        className={`absolute top-3 bottom-3 left-3 z-10 flex w-[400px] flex-col overflow-hidden rounded-3xl bg-[var(--card)] shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-transform duration-500 ${hidden ? '-translate-x-[110%]' : ''}`}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </section>
    )
  }

  const cycle = () => onSnapChange(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length])

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const full = boxRef.current?.offsetHeight ?? window.innerHeight
    e.currentTarget.setPointerCapture(e.pointerId)
    gesture.current = {
      startY: e.clientY,
      startVisible: snapHeight(snap, full),
      full,
      lastY: e.clientY,
      lastT: e.timeStamp,
      v: 0,
    }
  }

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g) return
    const dt = e.timeStamp - g.lastT
    if (dt > 0) g.v = (e.clientY - g.lastY) / dt // px/ms, negative = upward
    g.lastY = e.clientY
    g.lastT = e.timeStamp
    if (dragVisible === null && Math.abs(e.clientY - g.startY) < TAP_SLOP_PX) return
    setDragVisible(Math.min(g.full, Math.max(PEEK_PX, g.startVisible + g.startY - e.clientY)))
  }

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (dragVisible === null) return cycle() // never left the tap slop
    // A stale pointer velocity (finger paused before lift) must not count as a flick.
    const v = e.timeStamp - g.lastT < 80 ? g.v : 0
    const i = ORDER.indexOf(snap)
    let next: Snap
    if (Math.abs(v) > FLICK_PX_PER_MS) {
      next = ORDER[Math.min(ORDER.length - 1, Math.max(0, i + (v < 0 ? 1 : -1)))]
    } else {
      next = ORDER.reduce((best, s) =>
        Math.abs(snapHeight(s, g.full) - dragVisible) < Math.abs(snapHeight(best, g.full) - dragVisible) ? s : best,
      )
    }
    setDragVisible(null)
    onSnapChange(next)
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      cycle()
    }
  }

  // Container is always full height; only its translation changes (GPU-friendly).
  const offset =
    dragVisible !== null
      ? `calc(${FULL_HEIGHT} - ${dragVisible}px)`
      : snap === 'full'
        ? '0px'
        : snap === 'half'
          ? `calc(${FULL_HEIGHT} - 50dvh)`
          : `calc(${FULL_HEIGHT} - ${PEEK_PX}px)`
  const visible =
    dragVisible !== null ? `${dragVisible}px` : snap === 'full' ? FULL_HEIGHT : snap === 'half' ? '50dvh' : `${PEEK_PX}px`

  return (
    <section
      ref={boxRef}
      role="region"
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl bg-[var(--card)] shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
      style={{
        height: FULL_HEIGHT,
        transform: hidden ? 'translateY(110%)' : `translateY(${offset})`,
        transition: dragVisible === null ? 'transform 320ms cubic-bezier(0.32,0.72,0,1)' : 'none',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Resize panel"
        className="flex h-11 shrink-0 cursor-grab items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--red)] focus-visible:outline-none active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          gesture.current = null
          setDragVisible(null)
        }}
        onKeyDown={onKey}
      >
        <span className="h-1.5 w-10 rounded-full bg-[var(--line)]" />
      </div>
      <div
        className="min-h-0 overflow-y-auto overscroll-contain"
        // Scroll area matches the visible part, so sticky footers (search CTA, total) sit above the fold.
        style={{ height: `calc(${visible} - 2.75rem)`, paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {children}
      </div>
    </section>
  )
}
