import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { MapData } from '../data/schema'
import type { Corridor, Mode, Reading } from '../model/types'
import { project, type Point } from '../geo/project'
import { formatSpeed } from '../model/time'
import { Icon } from '../ui/Icon'
import { boundsOf, clampView, fit, panBy, scaleBar, toScreen, toWorld, zoomAt, type Bounds, type Size, type View } from './camera'
import { advance, densities } from './flows'
import { midpoint, pick } from './pick'
import { createMapScene, type Backend, type MapScene } from './scene'
import './map.css'

export type MapStatus = { kind: 'loading' } | { kind: 'ready'; backend: Backend; particles: number } | { kind: 'error'; message: string }

export interface Inset {
  top: number
  right: number
  bottom: number
  left: number
}

interface Props {
  data: MapData
  corridors: readonly Corridor[]
  readings: readonly Reading[]
  layers: Record<Mode, boolean>
  selected: string | null
  onSelect: (id: string | null) => void
  motion: boolean
  inset: Inset
  forceWebGL?: boolean
  particles?: number
  onStatus: (status: MapStatus) => void
  /** One-sentence summary of the current state, for the map's accessible description. */
  summary: string
}

/** Central Lagos, from Mile 2 to Lekki and Ikeja to the beach. */
const HOME = (() => {
  const [minX, minY] = project(3.3, 6.425)
  const [maxX, maxY] = project(3.52, 6.615)
  return { minX, minY, maxX, maxY }
})()

const WATER_LABELS: { name: string; at: Point; rank: 1 | 2 }[] = [
  { name: 'Lagos Lagoon', at: project(3.47, 6.52), rank: 1 },
  { name: 'Atlantic Ocean', at: project(3.46, 6.385), rank: 1 },
  { name: 'Badagry Creek', at: project(3.25, 6.432), rank: 2 },
]

const START_VIEW: View = { x: 0, y: 0, zoom: 40 }
const START_SIZE: Size = { width: 1, height: 1 }

/** Rank 1 labels always; finer ones as you zoom in. */
const minZoomForRank = { 1: 0, 2: 34, 3: 70 } as const

export function MapView(props: Props) {
  const { data, corridors, readings, layers, selected, onSelect, motion, inset, forceWebGL, particles, onStatus, summary } = props
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<MapScene | null>(null)
  const sizeRef = useRef<Size>(START_SIZE)
  const viewRef = useRef<View>(START_VIEW)
  const dirty = useRef(true)
  const [view, setView] = useState<View>(START_VIEW)
  const [size, setSize] = useState<Size>(START_SIZE)
  const [ready, setReady] = useState(false)
  // Some GPUs hand out a WebGPU device and then lose it straight away; fall back to WebGL 2 once.
  const [fallback, setFallback] = useState(false)
  const [retries, setRetries] = useState(0)

  const latest = useRef({ readings, motion, onStatus })
  useLayoutEffect(() => {
    latest.current = { readings, motion, onStatus }
  })

  const lengths = useMemo(() => Object.fromEntries(corridors.map((c) => [c.id, data.corridors[c.id]?.length ?? 1])), [corridors, data])
  const bounds: Bounds = useMemo(() => {
    const b = boundsOf(Object.values(data.corridors).map((c) => c.line))
    return { minX: b.minX - 2, minY: b.minY - 2, maxX: b.maxX + 2, maxY: b.maxY + 2 }
  }, [data])

  /* View changes go to the GPU at once and to React (labels) once a frame. */
  const pending = useRef(0)
  const applyView = useCallback(
    (next: View) => {
      const v = clampView(next, bounds)
      viewRef.current = v
      sceneRef.current?.setView(v, sizeRef.current)
      dirty.current = true
      if (!pending.current)
        pending.current = requestAnimationFrame(() => {
          pending.current = 0
          setView(viewRef.current)
        })
    },
    [bounds],
  )

  const insetRef = useRef(inset)
  useLayoutEffect(() => {
    insetRef.current = inset
  })
  const home = useCallback(() => applyView(fit(HOME, sizeRef.current, insetRef.current)), [applyView])

  /* Renderer lifetime */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    let scene: MapScene | null = null
    let retryTimer = 0
    latest.current.onStatus({ kind: 'loading' })
    createMapScene(canvas, data, corridors, { forceWebGL: forceWebGL || fallback, particles })
      .then((s) => {
        if (cancelled) {
          s.dispose()
          return
        }
        scene = s
        sceneRef.current = s
        s.onContextLost(() => {
          if (s.backend === 'WebGPU' && !fallback) setFallback(true)
          else latest.current.onStatus({ kind: 'error', message: 'The graphics card dropped the map. Reload to draw it again.' })
        })
        s.resize(sizeRef.current, window.devicePixelRatio || 1)
        s.setView(viewRef.current, sizeRef.current)
        dirty.current = true
        setReady(true)
        latest.current.onStatus({ kind: 'ready', backend: s.backend, particles: s.particleCount })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error(err)
        // WebGPU can be advertised and still fail to start; give WebGL 2 one go before giving up.
        if (!forceWebGL && !fallback) {
          setFallback(true)
          return
        }
        // A crashed WebGPU attempt can take the GPU process down with it for a moment.
        if (fallback && retries < 2) {
          retryTimer = window.setTimeout(() => setRetries((n) => n + 1), 700)
          return
        }
        latest.current.onStatus({ kind: 'error', message: 'This browser could not start WebGPU or WebGL 2, so the map cannot be drawn here.' })
      })
    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
      scene?.dispose()
      sceneRef.current = null
      setReady(false)
    }
  }, [data, corridors, forceWebGL, particles, fallback, retries])

  /* Size */
  const fitted = useRef(false)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      const next = { width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) }
      sizeRef.current = next
      setSize(next)
      sceneRef.current?.resize(next, window.devicePixelRatio || 1)
      if (!fitted.current) {
        fitted.current = true
        viewRef.current = clampView(fit(HOME, next, insetRef.current), bounds)
      }
      applyView(viewRef.current)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [applyView, bounds])

  /* Lines: layers and selection */
  const brightness = useMemo(() => {
    const out = new Float32Array(corridors.length * 2)
    corridors.forEach((c, i) => {
      const on = layers[c.mode]
      const b = !on ? 0 : !selected ? 1 : c.id === selected ? 1 : 0.4
      out[i * 2] = b
      out[i * 2 + 1] = b
    })
    return out
  }, [corridors, layers, selected])
  const brightRef = useRef(brightness)
  useLayoutEffect(() => {
    brightRef.current = brightness
  }, [brightness])

  useEffect(() => {
    sceneRef.current?.setLines(corridors.map((c) => ({ visible: layers[c.mode], selected: c.id === selected, dimmed: !!selected && c.id !== selected })))
    dirty.current = true
  }, [corridors, layers, selected, ready])

  useEffect(() => {
    dirty.current = true
  }, [readings])

  /* Frame loop */
  useEffect(() => {
    if (!ready) return
    const progress = new Float32Array(corridors.length * 2)
    // Spread the starting positions so a paused map isn't all bunched up.
    progress.forEach((_, i) => (progress[i] = (i * 0.618) % 1))
    let last = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const { readings, motion } = latest.current
      const scene = sceneRef.current
      if (scene && (motion || dirty.current)) {
        if (motion) advance(progress, corridors, readings, lengths, dt)
        scene.setFlowState(progress, densities(corridors, readings), brightRef.current)
        scene.render()
        dirty.current = false
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [ready, corridors, lengths])

  /* Gestures */
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<{ start: Point; moved: number; pinch: number | null; mid: Point | null }>({ start: [0, 0], moved: 0, pinch: null, mid: null })

  const local = (e: { clientX: number; clientY: number }): Point => {
    const r = wrapRef.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 1) gesture.current = { start: p, moved: 0, pinch: null, mid: null }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [Point, Point]
      gesture.current.pinch = Math.hypot(a[0] - b[0], a[1] - b[1])
      gesture.current.mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      gesture.current.moved = Infinity
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const p = local(e)
    pointers.current.set(e.pointerId, p)
    if (pointers.current.size === 1) {
      gesture.current.moved += Math.hypot(p[0] - prev[0], p[1] - prev[1])
      applyView(panBy(viewRef.current, p[0] - prev[0], p[1] - prev[1]))
    } else if (pointers.current.size === 2 && gesture.current.pinch && gesture.current.mid) {
      const [a, b] = [...pointers.current.values()] as [Point, Point]
      const d = Math.hypot(a[0] - b[0], a[1] - b[1])
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      let v = zoomAt(viewRef.current, sizeRef.current, d / gesture.current.pinch, mid)
      v = panBy(v, mid[0] - gesture.current.mid[0], mid[1] - gesture.current.mid[1])
      gesture.current.pinch = d
      gesture.current.mid = mid
      applyView(v)
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const had = pointers.current.delete(e.pointerId)
    if (!had) return
    if (pointers.current.size === 0 && gesture.current.moved < 6) {
      const world = toWorld(viewRef.current, sizeRef.current, local(e))
      const radius = (e.pointerType === 'touch' ? 22 : 12) / viewRef.current.zoom
      const hit = pick(
        world,
        corridors.map((c) => ({ id: c.id, line: data.corridors[c.id]?.line ?? [], visible: layers[c.mode] })),
        radius,
      )
      onSelect(hit)
    }
    if (pointers.current.size < 2) gesture.current.pinch = null
  }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const scale = e.deltaMode === 1 ? 0.05 : 0.0018
      applyView(zoomAt(viewRef.current, sizeRef.current, Math.exp(-e.deltaY * scale), [e.clientX - r.left, e.clientY - r.top]))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyView])

  const centre = (): Point => [sizeRef.current.width / 2, sizeRef.current.height / 2]
  const zoomBy = (f: number) => applyView(zoomAt(viewRef.current, sizeRef.current, f, centre()))

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 200 : 70
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    const move = moves[e.key]
    if (move) applyView(panBy(viewRef.current, move[0], move[1]))
    else if (e.key === '+' || e.key === '=') zoomBy(1.4)
    else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.4)
    else if (e.key === '0') home()
    else if (e.key === 'Escape' && selected) onSelect(null)
    else return
    e.preventDefault()
  }

  /* Overlay */
  const visibleLabels = useMemo(() => {
    const places = data.places
      .filter((p) => view.zoom >= minZoomForRank[p.rank])
      .map((p) => ({ name: p.name, at: [p.x, p.y] as Point, kind: 'place' as const, rank: p.rank }))
    const water = WATER_LABELS.filter((w) => view.zoom >= minZoomForRank[w.rank]).map((w) => ({ ...w, kind: 'water' as const }))
    return [...water, ...places]
  }, [data, view.zoom])

  const selectedCorridor = corridors.find((c) => c.id === selected)
  const selectedReading = readings.find((r) => r.id === selected)
  const callout = useMemo(() => {
    if (!selectedCorridor || !selectedReading || !layers[selectedCorridor.mode]) return null
    const at = toScreen(view, size, midpoint(data.corridors[selectedCorridor.id]?.line ?? []))
    if (at[0] < 0 || at[1] < 0 || at[0] > size.width || at[1] > size.height) return null
    // Text to the right if it fits, else to the left, else (narrow phones) underneath.
    const roomRight = size.width - inset.right - at[0]
    const place: 'right' | 'left' | 'below' = roomRight > 300 ? 'right' : at[0] - inset.left > 300 ? 'left' : 'below'
    const shift = place === 'below' ? Math.min(size.width - 250, Math.max(10, at[0] - 110)) - at[0] : 0
    let title = selectedCorridor.name
    let detail: string
    if (selectedCorridor.mode === 'road') {
      const dir = selectedReading.slowDirection ?? 0
      title = `${selectedCorridor.name}, ${selectedCorridor.directions[dir]}`
      detail = `${formatSpeed(selectedReading.speed)} · ${selectedReading.volume.toLocaleString('en-NG')} vehicles / 10 min`
    } else if (selectedReading.headway == null) detail = 'Not running now'
    else detail = `${formatSpeed(selectedReading.speed)} · every ${selectedReading.headway} min`
    return { at, place, shift, title, detail }
  }, [selectedCorridor, selectedReading, layers, view, size, data, inset.right, inset.left])

  const bar = scaleBar(view.zoom)

  return (
    <div className="map" ref={wrapRef}>
      {/* A canvas keeps whichever context it first handed out, so the fallback needs a fresh one. */}
      <canvas key={fallback ? `webgl-${retries}` : 'auto'} ref={canvasRef} className="map-canvas" aria-hidden="true" />
      <div
        className="map-hit"
        role="application"
        aria-roledescription="map"
        aria-label="Map of Lagos movement"
        aria-describedby="map-help map-summary"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => applyView(zoomAt(viewRef.current, sizeRef.current, 2, local(e)))}
        onKeyDown={onKeyDown}
      />
      <p id="map-help" className="sr-only">
        Arrow keys pan, plus and minus zoom, 0 returns to central Lagos, Escape clears the selection. Every corridor on the map is also in the corridor list and
        the table view.
      </p>
      <p id="map-summary" className="sr-only">
        {summary}
      </p>

      <div className="map-labels" aria-hidden="true">
        {visibleLabels.map((l) => {
          const [x, y] = toScreen(view, size, l.at)
          return (
            <span key={l.name} className={`map-label ${l.kind} rank-${l.rank}`} style={{ transform: `translate(${x}px, ${y}px)` }}>
              {l.name}
            </span>
          )
        })}
        {view.zoom >= 30 &&
          data.stops
            .filter((st) => layers[st.mode])
            .map((st) => {
              const [x, y] = toScreen(view, size, [st.x, st.y])
              return (
                <span key={st.name} className={`map-stop ${st.mode}`} style={{ transform: `translate(${x}px, ${y}px)` }}>
                  {view.zoom >= 80 && <span>{st.name}</span>}
                </span>
              )
            })}
        {callout && (
          <div className={`callout ${callout.place}`} style={{ transform: `translate(${callout.at[0]}px, ${callout.at[1]}px)` }}>
            <span className="callout-dot" />
            <span className="callout-line" />
            <span className="callout-text mono" style={callout.place === 'below' ? { left: callout.shift } : undefined}>
              <b>{callout.title}</b>
              <span>{callout.detail}</span>
            </span>
          </div>
        )}
      </div>

      <div className="map-controls" style={{ bottom: inset.bottom + 12, right: inset.right + 12 }}>
        <div className="zoom-group panel">
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.5)}>
            <Icon name="plus" />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.5)}>
            <Icon name="minus" />
          </button>
          <button type="button" aria-label="Back to central Lagos" onClick={home}>
            <Icon name="target" />
          </button>
        </div>
        <div className="scale mono" aria-hidden="true">
          {bar.label}
          <svg width={bar.px} height="8">
            <path d={`M0.5 1V7H${bar.px - 0.5}V1`} fill="none" stroke="currentColor" />
          </svg>
        </div>
      </div>
    </div>
  )
}
