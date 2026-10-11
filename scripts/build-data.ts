/**
 * Turns the raw Overpass responses in data/raw into public/data/lagos.json:
 * every corridor traced along real OSM ways, a faint street mesh, water and
 * place labels, all projected to kilometres and simplified.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { CORRIDORS } from '../src/model/corridors.ts'
import type { Corridor } from '../src/model/types.ts'
import { Graph } from '../src/geo/graph.ts'
import { length, removeSpurs, simplify } from '../src/geo/polyline.ts'
import { project, type Point } from '../src/geo/project.ts'
import { assembleRings, pointInRing } from '../src/geo/rings.ts'
import type { MapData } from '../src/data/schema.ts'

interface OsmWay {
  type: 'way'
  id: number
  nodes?: number[]
  tags?: Record<string, string>
  geometry?: ({ lat: number; lon: number } | null)[]
}
interface OsmRelation {
  type: 'relation'
  id: number
  tags?: Record<string, string>
  members: { type: string; ref: number; role: string; geometry?: ({ lat: number; lon: number } | null)[] }[]
}
interface OsmNode {
  type: 'node'
  id: number
  lat: number
  lon: number
  tags?: Record<string, string>
}
type OsmElement = OsmWay | OsmRelation | OsmNode

const RAW = new URL('../data/raw/', import.meta.url)
const load = (name: string): OsmElement[] => {
  const file = new URL(`${name}.json`, RAW)
  if (!existsSync(file)) throw new Error(`data/raw/${name}.json is missing; run npm run data:fetch first`)
  return (JSON.parse(readFileSync(file, 'utf8')) as { elements: OsmElement[] }).elements
}

const round = (v: number, places = 3) => Math.round(v * 10 ** places) / 10 ** places
const roundLine = (line: Point[], places = 3) => line.map(([x, y]) => [round(x, places), round(y, places)] as [number, number])
const ways = (els: OsmElement[]) => els.filter((e): e is OsmWay => e.type === 'way' && !!e.geometry)

/* Graphs to trace corridors through ----------------------------------- */

function buildGraph(list: OsmWay[], weight: (w: OsmWay) => number, visit?: (w: OsmWay, node: number) => void, respectOneway = true) {
  const g = new Graph()
  for (const w of list) {
    if (!w.nodes || !w.geometry) continue
    const k = weight(w)
    const tag = w.tags?.oneway
    const oneway: -1 | 0 | 1 = !respectOneway ? 0 : tag === 'yes' || tag === '1' || w.tags?.junction === 'roundabout' ? 1 : tag === '-1' ? -1 : 0
    let prev = -1
    w.geometry.forEach((p, i) => {
      if (!p) {
        prev = -1
        return
      }
      const n = g.node(w.nodes![i]!, project(p.lon, p.lat))
      visit?.(w, n)
      if (prev >= 0) g.link(prev, n, k, oneway)
      prev = n
    })
  }
  return g
}

const roadWays = [...ways(load('streets')), ...ways(load('corridors'))]
const railWays = ways(load('rail'))

function trace(c: Corridor): Point[] {
  // Strictest first: snapped onto the named road and obeying one-way streets.
  for (const [snap, oneway] of [
    [true, true],
    [false, true],
    [false, false],
  ] as const) {
    const line = traceWith(c, snap, oneway)
    if (line) return line
    console.warn(`${c.id}: retrying with snap=${!snap} oneway=${oneway}`)
  }
  throw new Error(`${c.id}: no path through the via points`)
}

function traceWith(c: Corridor, snap: boolean, respectOneway: boolean): Point[] | null {
  let g: Graph
  let preferred: ((i: number) => boolean) | undefined
  if (c.mode === 'rail') {
    const tag = c.rail ?? 'rail'
    g = buildGraph(
      railWays.filter((w) => w.tags?.railway === tag || (tag === 'subway' && /blue line/i.test(w.tags?.name ?? ''))),
      (w) => (w.tags?.usage === 'industrial' ? 4 : 1),
    )
  } else if (c.mode === 'ferry') {
    const way = ferryWays.find((w) => w.id === c.osmWay)
    if (!way) throw new Error(`${c.id}: ferry way ${c.osmWay} not in data/raw/ferry.json`)
    const line = way.geometry!.filter((p) => p !== null).map((p) => project(p!.lon, p!.lat))
    const [lat, lon] = c.via[0]!
    const start = project(lon, lat)
    // Ferry ways are drawn in either direction; start at the end nearest the first via point.
    const d = (p: Point) => Math.hypot(p[0] - start[0], p[1] - start[1])
    return d(line[0]!) <= d(line[line.length - 1]!) ? line : line.reverse()
  } else {
    const prefer = new Set((c.prefer ?? []).map((n) => n.toLowerCase()))
    const onPreferred = new Set<number>()
    g = buildGraph(
      roadWays,
      (w) => {
        const name = (w.tags?.name ?? '').toLowerCase()
        if (prefer.has(name)) return 1
        // Without a preference, stick to the big roads a bus or car would really take.
        const hw = w.tags?.highway ?? ''
        return prefer.size ? 6 : /motorway|trunk/.test(hw) ? 1 : 1.6
      },
      (w, node) => {
        if (prefer.has((w.tags?.name ?? '').toLowerCase())) onPreferred.add(node)
      },
      respectOneway,
    )
    // Snap the ends of single-road corridors onto that road, not a side street.
    if (snap && c.mode === 'road' && prefer.size) preferred = (i) => onPreferred.has(i)
  }
  // A via point can land on the wrong carriageway of a one-way pair, so each
  // via gets a few candidate nodes and a small dynamic programme picks the
  // combination with the cheapest total path.
  const candidates = c.via.map(([lat, lon]) => g.nearestN(project(lon, lat), 6, preferred))
  let layer = candidates[0]!.map((n) => ({ node: n, cost: 0, path: [n] }))
  for (let i = 1; i < candidates.length; i++) {
    layer = candidates[i]!.map((b) => {
      let best = { node: b, cost: Infinity, path: [] as number[] }
      for (const prev of layer) {
        if (prev.cost === Infinity) continue
        const path = g.path(prev.node, b)
        if (!path) continue
        const cost = prev.cost + g.cost(path)
        if (cost < best.cost) best = { node: b, cost, path: [...prev.path, ...path.slice(1)] }
      }
      return best
    })
  }
  const best = layer.reduce((a, b) => (b.cost < a.cost ? b : a))
  if (best.cost === Infinity) return null
  return best.path.map((n) => g.points[n]!)
}
const ferryWays = ways(load('ferry'))

/* Water ---------------------------------------------------------------- */

const geom = (g: ({ lat: number; lon: number } | null)[] | undefined) =>
  (g ?? []).filter((p): p is { lat: number; lon: number } => p !== null).map((p) => project(p.lon, p.lat))

/** Lagoon, creeks and harbour as polygons with their islands cut out. */
function waterPolygons(): Point[][][] {
  const out: Point[][][] = []
  const seen = new Set<number>()
  for (const e of load('water')) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    if (e.type === 'way' && e.geometry) {
      out.push([geom(e.geometry)])
      continue
    }
    if (e.type !== 'relation') continue
    const outer = assembleRings(e.members.filter((m) => m.role === 'outer').map((m) => geom(m.geometry)))
    const inner = assembleRings(e.members.filter((m) => m.role === 'inner').map((m) => geom(m.geometry)))
    if (outer.open.length) console.warn(`${e.tags?.name}: ${outer.open.length} outer chains did not close`)
    for (const ring of outer.rings) {
      const holes = inner.rings.filter((h) => pointInRing(h[0]!, ring))
      out.push([ring, ...holes])
    }
  }
  return out
}

/**
 * The coastline only runs along the beach (OSM keeps land on its left), so the
 * ocean is closed off by running round the bottom of the map from its east end.
 */
function oceanPolygon(): Point[][] {
  const coast = assembleRings(ways(load('coast')).map((w) => geom(w.geometry)))
  const chain = [...coast.open, ...coast.rings].sort((a, b) => b.length - a.length)[0]
  if (!chain) return []
  const line = chain[0]![0] < chain[chain.length - 1]![0] ? chain : [...chain].reverse()
  const south = Math.min(...line.map((p) => p[1])) - 25
  return [[...line, [line[line.length - 1]![0], south], [line[0]![0], south]]]
}

const BOX = (() => {
  const [s, w, n, e] = [6.38, 3.2, 6.67, 3.64]
  const [minX, minY] = project(w, s)
  const [maxX, maxY] = project(e, n)
  return { minX: minX - 6, minY: minY - 6, maxX: maxX + 6, maxY: maxY + 6 }
})()

/** Drops polygons entirely outside the map and simplifies the rest. */
function tidy(polygons: Point[][][], tolerance: number) {
  return polygons
    .filter(([outer]) => outer && outer.some(([x, y]) => x > BOX.minX && x < BOX.maxX && y > BOX.minY && y < BOX.maxY))
    .map((rings) => rings.map((r) => roundLine(simplify(r, tolerance))).filter((r) => r.length >= 4))
    .filter((rings) => rings.length > 0)
}

/* Everything together ------------------------------------------------- */

const corridors: MapData['corridors'] = {}
for (const c of CORRIDORS) {
  const raw = removeSpurs(trace(c), 0.12, 0.3)
  const line = simplify(raw, 0.012)
  corridors[c.id] = { line: roundLine(line), length: round(length(raw), 2) }
  console.log(`${c.id.padEnd(18)} ${length(raw).toFixed(1).padStart(5)} km  ${raw.length} → ${line.length} pts`)
}

const streets = ways(load('streets'))
  .filter((w) => !/link/.test(w.tags?.highway ?? ''))
  .map((w) => simplify(geom(w.geometry), 0.02))
  .filter((l) => l.length > 1 && length(l) > 0.08)
  .map((l) => roundLine(l, 2))

const data: MapData = {
  attribution: '© OpenStreetMap contributors, ODbL',
  generated: new Date().toISOString().slice(0, 10),
  corridors,
  streets,
  water: tidy([oceanPolygon(), ...waterPolygons()], 0.025),
  places: [],
  stops: [],
}

const out = new URL('../public/data/lagos.json', import.meta.url)
writeFileSync(out, JSON.stringify(data))
console.log(`wrote public/data/lagos.json (${(JSON.stringify(data).length / 1024).toFixed(0)} KB)`)
