import type { Point } from './project'

export const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1])

export function length(line: readonly Point[]): number {
  let total = 0
  for (let i = 1; i < line.length; i++) total += dist(line[i - 1]!, line[i]!)
  return total
}

/** Cumulative distance at each vertex; the last value is the total length. */
export function cumulative(line: readonly Point[]): number[] {
  const out = [0]
  for (let i = 1; i < line.length; i++) out.push(out[i - 1]! + dist(line[i - 1]!, line[i]!))
  return out
}

/** Point at fraction t (0..1) of the way along the line, by distance. */
export function pointAt(line: readonly Point[], t: number, cum = cumulative(line)): Point {
  if (line.length === 0) throw new Error('empty line')
  if (line.length === 1) return line[0]!
  const target = Math.min(Math.max(t, 0), 1) * cum[cum.length - 1]!
  let lo = 0
  let hi = cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid]! <= target) lo = mid
    else hi = mid
  }
  const span = cum[hi]! - cum[lo]!
  const f = span === 0 ? 0 : (target - cum[lo]!) / span
  const a = line[lo]!
  const b = line[hi]!
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
}

/** n points spaced evenly by distance, first and last included. */
export function resample(line: readonly Point[], n: number): Point[] {
  const cum = cumulative(line)
  return Array.from({ length: n }, (_, i) => pointAt(line, n === 1 ? 0 : i / (n - 1), cum))
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
  return dist(p, [a[0] + t * dx, a[1] + t * dy])
}

export function distanceToLine(p: Point, line: readonly Point[]): number {
  if (line.length === 1) return dist(p, line[0]!)
  let best = Infinity
  for (let i = 1; i < line.length; i++) best = Math.min(best, segmentDistance(p, line[i - 1]!, line[i]!))
  return best
}

/** Ramer–Douglas–Peucker, iterative so long roads can't blow the stack. */
export function simplify(line: readonly Point[], tolerance: number): Point[] {
  if (line.length < 3) return [...line]
  const keep = new Uint8Array(line.length)
  keep[0] = 1
  keep[line.length - 1] = 1
  const stack: [number, number][] = [[0, line.length - 1]]
  while (stack.length) {
    const [start, end] = stack.pop()!
    let worst = 0
    let index = -1
    for (let i = start + 1; i < end; i++) {
      const d = segmentDistance(line[i]!, line[start]!, line[end]!)
      if (d > worst) {
        worst = d
        index = i
      }
    }
    if (worst > tolerance && index > 0) {
      keep[index] = 1
      stack.push([start, index], [index, end])
    }
  }
  return line.filter((_, i) => keep[i])
}
