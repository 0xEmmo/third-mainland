import type { Mode } from '../model/types'

type XY = [number, number]

/** The shape of public/data/lagos.json. All coordinates are kilometres from ORIGIN. */
export interface MapData {
  attribution: string
  generated: string
  corridors: Record<string, { line: XY[]; length: number }>
  /** Faint background street mesh. */
  streets: XY[][]
  /** Water polygons, each a list of rings; the first ring is the outline. */
  water: XY[][][]
  places: { name: string; x: number; y: number; rank: 1 | 2 | 3 }[]
  stops: { name: string; x: number; y: number; mode: Mode }[]
}
