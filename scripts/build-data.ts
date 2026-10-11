/**
 * Turns the raw Overpass responses in data/raw into public/data/lagos.json:
 * every corridor traced along real OSM ways, a faint street mesh, water and
 * place labels, all projected to kilometres and simplified.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { CORRIDORS } from '../src/model/corridors.ts'
import type { Corridor } from '../src/model/types.ts'
import { Graph } from '../src/geo/graph.ts'
import { length, simplify } from '../src/geo/polyline.ts'
import { project, type Point } from '../src/geo/project.ts'
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

function buildGraph(list: OsmWay[], weight: (w: OsmWay) => number) {
  const g = new Graph()
  for (const w of list) {
    if (!w.nodes || !w.geometry) continue
    const k = weight(w)
    let prev = -1
    w.geometry.forEach((p, i) => {
      if (!p) {
        prev = -1
        return
      }
      const n = g.node(w.nodes![i]!, project(p.lon, p.lat))
      if (prev >= 0) g.link(prev, n, k)
      prev = n
    })
  }
  return g
}

const roadWays = [...ways(load('streets')), ...ways(load('corridors'))]
const railWays = ways(load('rail'))

function trace(c: Corridor): Point[] {
  let g: Graph
  if (c.mode === 'rail') {
    const tag = c.rail ?? 'rail'
    g = buildGraph(
      railWays.filter((w) => w.tags?.railway === tag || (tag === 'subway' && /blue line/i.test(w.tags?.name ?? ''))),
      (w) => (w.tags?.usage === 'industrial' ? 4 : 1),
    )
  } else if (c.mode === 'ferry') {
    g = buildGraph(ferryWays, () => 1)
  } else {
    const prefer = new Set((c.prefer ?? []).map((n) => n.toLowerCase()))
    g = buildGraph(roadWays, (w) => {
      const name = (w.tags?.name ?? '').toLowerCase()
      if (prefer.has(name)) return 1
      // Without a preference, stick to the big roads a bus or car would really take.
      const hw = w.tags?.highway ?? ''
      return prefer.size ? 6 : /motorway|trunk/.test(hw) ? 1 : 1.6
    })
  }
  const stops = c.via.map(([lat, lon]) => g.nearest(project(lon, lat)))
  const out: Point[] = []
  for (let i = 1; i < stops.length; i++) {
    const path = g.path(stops[i - 1]!, stops[i]!)
    if (!path) throw new Error(`${c.id}: no path between via ${i - 1} and ${i}`)
    const pts = path.map((n) => g.points[n]!)
    out.push(...(out.length ? pts.slice(1) : pts))
  }
  return out
}

/* Ferries -------------------------------------------------------------- */

const ferryWays = existsSync(new URL('ferry.json', RAW)) ? ways(load('ferry')) : []

/* Everything together ------------------------------------------------- */

const corridors: MapData['corridors'] = {}
for (const c of CORRIDORS) {
  const raw = trace(c)
  const line = simplify(raw, 0.012)
  corridors[c.id] = { line: roundLine(line), length: round(length(raw), 2) }
  console.log(`${c.id.padEnd(18)} ${length(raw).toFixed(1).padStart(5)} km  ${raw.length} → ${line.length} pts`)
}

const streets = ways(load('streets'))
  .filter((w) => !/link/.test(w.tags?.highway ?? ''))
  .map((w) =>
    simplify(
      w.geometry!.filter((p) => p !== null).map((p) => project(p!.lon, p!.lat)),
      0.02,
    ),
  )
  .filter((l) => l.length > 1 && length(l) > 0.08)
  .map((l) => roundLine(l, 2))

const data: MapData = {
  attribution: '© OpenStreetMap contributors, ODbL',
  generated: new Date().toISOString().slice(0, 10),
  corridors,
  streets,
  water: [],
  places: [],
  stops: [],
}

const out = new URL('../public/data/lagos.json', import.meta.url)
writeFileSync(out, JSON.stringify(data))
console.log(`wrote public/data/lagos.json (${(JSON.stringify(data).length / 1024).toFixed(0)} KB)`)
