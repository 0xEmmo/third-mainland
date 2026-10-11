import type { Point } from './project'

const key = ([x, y]: Point) => `${x.toFixed(6)},${y.toFixed(6)}`

/**
 * OSM multipolygons arrive as loose ways that only close once they are joined
 * end to end, sometimes reversed. This joins them greedily into closed rings;
 * chains that never close are returned separately so the caller can decide.
 */
export function assembleRings(parts: readonly (readonly Point[])[]): { rings: Point[][]; open: Point[][] } {
  const pool = parts.filter((p) => p.length > 1).map((p) => [...p])
  const rings: Point[][] = []
  const open: Point[][] = []
  while (pool.length) {
    let chain = pool.shift()!
    for (;;) {
      if (key(chain[0]!) === key(chain[chain.length - 1]!)) {
        rings.push(chain)
        break
      }
      const end = key(chain[chain.length - 1]!)
      const start = key(chain[0]!)
      const i = pool.findIndex((p) => [key(p[0]!), key(p[p.length - 1]!)].some((k) => k === end || k === start))
      if (i < 0) {
        open.push(chain)
        break
      }
      const next = pool.splice(i, 1)[0]!
      const nStart = key(next[0]!)
      const nEnd = key(next[next.length - 1]!)
      if (nStart === end) chain = [...chain, ...next.slice(1)]
      else if (nEnd === end) chain = [...chain, ...next.reverse().slice(1)]
      else if (nEnd === start) chain = [...next, ...chain.slice(1)]
      else chain = [...next.reverse(), ...chain.slice(1)]
    }
  }
  return { rings, open }
}

/** Shoelace area; positive when the ring runs anticlockwise. */
export function signedArea(ring: readonly Point[]): number {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!
    const q = ring[(i + 1) % ring.length]!
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

export function pointInRing([x, y]: Point, ring: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
