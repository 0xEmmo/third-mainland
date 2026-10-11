import type { Point } from './project'
import { dist } from './polyline'

export interface Edge {
  to: number
  cost: number
}

/**
 * A plain adjacency-list graph of OSM nodes. Used at build time to trace a
 * corridor from one end to the other along the ways that really exist,
 * instead of drawing a line by hand.
 */
export class Graph {
  readonly points: Point[] = []
  readonly edges: Edge[][] = []
  private ids = new Map<number, number>()
  private incoming = new Set<number>()

  node(osmId: number, p: Point): number {
    let i = this.ids.get(osmId)
    if (i === undefined) {
      i = this.points.length
      this.ids.set(osmId, i)
      this.points.push(p)
      this.edges.push([])
    }
    return i
  }

  /** `oneway` follows OSM: 1 means a→b only, -1 means b→a only, 0 both ways. */
  link(a: number, b: number, weight = 1, oneway: -1 | 0 | 1 = 0) {
    const cost = dist(this.points[a]!, this.points[b]!) * weight
    if (oneway >= 0) this.edges[a]!.push({ to: b, cost })
    if (oneway <= 0) this.edges[b]!.push({ to: a, cost })
    this.incoming.add(oneway >= 0 ? b : a)
  }

  nearest(p: Point): number {
    return this.nearestN(p, 1)[0] ?? -1
  }

  /** The n closest connected nodes, nearest first. */
  nearestN(p: Point, n: number, filter?: (i: number) => boolean): number[] {
    const scored: [number, number][] = []
    this.points.forEach((q, i) => {
      if (this.edges[i]!.length === 0 && !this.incoming.has(i)) return
      if (filter && !filter(i)) return
      scored.push([dist(p, q), i])
    })
    return scored
      .sort((a, b) => a[0] - b[0])
      .slice(0, n)
      .map(([, i]) => i)
  }

  cost(path: readonly number[]): number {
    let total = 0
    for (let i = 1; i < path.length; i++) total += this.edges[path[i - 1]!]!.find((e) => e.to === path[i])?.cost ?? Infinity
    return total
  }

  /** Dijkstra with a binary heap. Returns node indices, or null if unreachable. */
  path(from: number, to: number): number[] | null {
    const n = this.points.length
    const best = new Float64Array(n).fill(Infinity)
    const prev = new Int32Array(n).fill(-1)
    const heap = new MinHeap()
    best[from] = 0
    heap.push(from, 0)
    while (heap.size) {
      const [u, d] = heap.pop()
      if (u === to) break
      if (d > best[u]!) continue
      for (const { to: v, cost } of this.edges[u]!) {
        const nd = d + cost
        if (nd < best[v]!) {
          best[v] = nd
          prev[v] = u
          heap.push(v, nd)
        }
      }
    }
    if (best[to] === Infinity) return null
    const out = [to]
    while (out[out.length - 1] !== from) out.push(prev[out[out.length - 1]!]!)
    return out.reverse()
  }
}

class MinHeap {
  private items: [number, number][] = []
  get size() {
    return this.items.length
  }
  push(value: number, priority: number) {
    const a = this.items
    a.push([value, priority])
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p]![1] <= a[i]![1]) break
      ;[a[p], a[i]] = [a[i]!, a[p]!]
      i = p
    }
  }
  pop(): [number, number] {
    const a = this.items
    const top = a[0]!
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l]![1] < a[m]![1]) m = l
        if (r < a.length && a[r]![1] < a[m]![1]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i]!, a[m]!]
        i = m
      }
    }
    return top
  }
}
