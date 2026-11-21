import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { Station } from '../api/types'

interface Props {
  label: string
  dot: 'hollow' | 'solid'
  value: Station | null
  onChange: (s: Station | null) => void
  autoFocus?: boolean
}

export default function StationInput({ label, dot, value, onChange, autoFocus }: Props) {
  const [text, setText] = useState(value?.name ?? '')
  const [hits, setHits] = useState<Station[]>([])
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setText(value?.name ?? '')
  }, [value])

  useEffect(() => {
    if (!editing.current || text.trim().length < 2) {
      setHits([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      api.stations(text.trim(), ctrl.signal).then(
        (h) => {
          setHits(h)
          setCursor(0)
        },
        () => {},
      )
    }, 180)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [text])

  const pick = (s: Station) => {
    editing.current = false
    setText(s.name)
    setOpen(false)
    onChange(s)
  }

  return (
    <div className="relative">
      <label className="flex items-center gap-3 px-4 py-3">
        <span
          className={`size-2.5 shrink-0 rounded-full border-2 border-[var(--green)] ${dot === 'solid' ? 'bg-[var(--green)]' : ''}`}
        />
        <span className="sr-only">{label}</span>
        <input
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]"
          placeholder={label}
          value={text}
          autoFocus={autoFocus}
          onFocus={(e) => {
            e.target.select()
            setOpen(true)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            editing.current = true
            setText(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setCursor((c) => Math.min(c + 1, hits.length - 1))
            else if (e.key === 'ArrowUp') setCursor((c) => Math.max(c - 1, 0))
            else if (e.key === 'Enter' && hits[cursor]) pick(hits[cursor])
            else if (e.key === 'Escape') setOpen(false)
          }}
        />
      </label>
      {open && hits.length > 0 && (
        <ul className="absolute inset-x-2 top-full z-20 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] py-1 shadow-xl">
          {hits.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${i === cursor ? 'bg-[var(--hover)]' : ''}`}
              >
                <span>{s.name}</span>
                <span className="font-mono text-xs text-[var(--muted)]">{s.country}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
