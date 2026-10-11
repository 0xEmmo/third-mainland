import { distanceToLine } from '../geo/polyline'
import type { Point } from '../geo/project'

export interface Pickable {
  id: string
  line: readonly Point[]
  visible: boolean
}

/** The visible corridor nearest the point, if any is within `radius` km. */
export function pick(point: Point, items: readonly Pickable[], radius: number): string | null {
  let best: string | null = null
  let bestD = radius
  for (const item of items) {
    if (!item.visible || item.line.length === 0) continue
    const d = distanceToLine(point, item.line)
    if (d <= bestD) {
      bestD = d
      best = item.id
    }
  }
  return best
}

/** Where to pin a callout: the vertex closest to halfway along. */
export function midpoint(line: readonly Point[]): Point {
  if (line.length === 0) return [0, 0]
  let total = 0
  for (let i = 1; i < line.length; i++) total += Math.hypot(line[i]![0] - line[i - 1]![0], line[i]![1] - line[i - 1]![1])
  let run = 0
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!
    const b = line[i]!
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (run + seg >= total / 2) {
      const f = seg === 0 ? 0 : (total / 2 - run) / seg
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
    }
    run += seg
  }
  return line[line.length - 1]!
}
