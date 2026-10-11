/**
 * Lagos fits comfortably inside a 60 km box, so a flat equirectangular
 * projection centred on the lagoon is accurate to well under 1% and keeps
 * the maths trivial: one scene unit is one kilometre.
 */
export const ORIGIN = { lat: 6.5, lon: 3.4 } as const

const KM_PER_DEG_LAT = 110.574
const KM_PER_DEG_LON = 111.32 * Math.cos((ORIGIN.lat * Math.PI) / 180)

export type Point = readonly [x: number, y: number]

export function project(lon: number, lat: number): Point {
  return [(lon - ORIGIN.lon) * KM_PER_DEG_LON, (lat - ORIGIN.lat) * KM_PER_DEG_LAT]
}

export function unproject([x, y]: Point): { lon: number; lat: number } {
  return { lon: x / KM_PER_DEG_LON + ORIGIN.lon, lat: y / KM_PER_DEG_LAT + ORIGIN.lat }
}
