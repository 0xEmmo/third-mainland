import type { Point } from '../geo/project'

/** Centre of the screen in km, and how many CSS pixels one km takes up. */
export interface View {
  x: number
  y: number
  zoom: number
}

export interface Size {
  width: number
  height: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const MIN_ZOOM = 12
export const MAX_ZOOM = 420

/** World y grows north; screen y grows down. */
export function toScreen(view: View, size: Size, [x, y]: Point): Point {
  return [(x - view.x) * view.zoom + size.width / 2, (view.y - y) * view.zoom + size.height / 2]
}

export function toWorld(view: View, size: Size, [sx, sy]: Point): Point {
  return [(sx - size.width / 2) / view.zoom + view.x, view.y - (sy - size.height / 2) / view.zoom]
}

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** Zooms by `factor` while keeping the world point under `anchor` (screen px) still. */
export function zoomAt(view: View, size: Size, factor: number, anchor: Point): View {
  const zoom = clampZoom(view.zoom * factor)
  const before = toWorld(view, size, anchor)
  const next = { ...view, zoom }
  const after = toWorld(next, size, anchor)
  return { zoom, x: view.x + before[0] - after[0], y: view.y + before[1] - after[1] }
}

export function panBy(view: View, dx: number, dy: number): View {
  return { ...view, x: view.x - dx / view.zoom, y: view.y + dy / view.zoom }
}

/** Keeps the centre inside the data, so the city can't be flung off-screen. */
export function clampView(view: View, bounds: Bounds): View {
  return {
    zoom: clampZoom(view.zoom),
    x: Math.min(bounds.maxX, Math.max(bounds.minX, view.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, view.y)),
  }
}

/**
 * Fits `bounds` inside the part of the screen not covered by panels.
 * `inset` is in CSS pixels: { top, right, bottom, left }.
 */
export function fit(bounds: Bounds, size: Size, inset = { top: 0, right: 0, bottom: 0, left: 0 }): View {
  const w = Math.max(1, size.width - inset.left - inset.right)
  const h = Math.max(1, size.height - inset.top - inset.bottom)
  const zoom = clampZoom(Math.min(w / (bounds.maxX - bounds.minX), h / (bounds.maxY - bounds.minY)))
  // Centre of the free area, in screen px, shifted back to the screen centre.
  const offsetX = (inset.left - inset.right) / 2
  const offsetY = (inset.top - inset.bottom) / 2
  return {
    zoom,
    x: (bounds.minX + bounds.maxX) / 2 - offsetX / zoom,
    y: (bounds.minY + bounds.maxY) / 2 + offsetY / zoom,
  }
}

export function boundsOf(lines: readonly (readonly Point[])[]): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const line of lines)
    for (const [x, y] of line) {
      b.minX = Math.min(b.minX, x)
      b.minY = Math.min(b.minY, y)
      b.maxX = Math.max(b.maxX, x)
      b.maxY = Math.max(b.maxY, y)
    }
  return b
}

/** A 1-2-5 scale bar about `target` pixels wide. */
export function scaleBar(zoom: number, target = 80): { km: number; px: number; label: string } {
  const raw = target / zoom
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].find((s) => s * pow >= raw * 0.75) ?? 10
  const km = step * pow
  return { km, px: km * zoom, label: km >= 1 ? `${km} km` : `${Math.round(km * 1000)} m` }
}
