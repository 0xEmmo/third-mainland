import type { Corridor, Mode, Reading } from '../model/types'
import { MAX_VEHICLES } from '../model/traffic'

/**
 * Particle layout for the GPU. Each particle only knows which corridor and
 * direction it belongs to, where it sits along the line (phase), and the
 * density at which it switches on (threshold). Motion and density come from a
 * tiny per-direction state texture that the CPU updates every frame, so 40,000
 * particles cost a few hundred floats of upload instead of 40,000 positions.
 */
export interface ParticleBuffers {
  count: number
  /** corridor row, direction (0 forward, 1 back), phase 0..1, threshold 0..1 */
  info: Float32Array
  /** lane offset in px, dot size in px, unused, unused */
  shape: Float32Array
  color: Float32Array
}

export const MODE_COLOR: Record<Mode, string> = {
  road: '#ffb547',
  brt: '#ff5b4a',
  ferry: '#3fd4ff',
  rail: '#7cf0b5',
}

/** Particles that make up one bus, train or boat. */
const VEHICLE_DOTS: Record<Exclude<Mode, 'road'>, number> = { brt: 3, rail: 6, ferry: 2 }

/** Reverses the low `bits` bits of i, so any prefix of 0..2^bits-1 is evenly spread. */
export function bitReverse(i: number, bits: number): number {
  let out = 0
  for (let b = 0; b < bits; b++) out |= ((i >> b) & 1) << (bits - 1 - b)
  return out
}

/** Deterministic PRNG so the map looks the same on every load (and in screenshots). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255) as [number, number, number]

export function particleBudget(corridors: readonly Corridor[], lengths: Record<string, number>, total: number) {
  const transit = corridors.filter((c) => c.mode !== 'road')
  const transitCount = transit.reduce((n, c) => n + MAX_VEHICLES * 2 * VEHICLE_DOTS[c.mode as Exclude<Mode, 'road'>], 0)
  const roadKm = corridors.filter((c) => c.mode === 'road').reduce((km, c) => km + (lengths[c.id] ?? 0) * 2, 0)
  const perKm = roadKm > 0 ? Math.max(0, total - transitCount) / roadKm : 0
  return corridors.map((c) => (c.mode === 'road' ? Math.round((lengths[c.id] ?? 0) * perKm) : MAX_VEHICLES * VEHICLE_DOTS[c.mode as Exclude<Mode, 'road'>]))
}

/** Builds the per-particle attributes. Counts returned are per direction. */
export function buildParticles(corridors: readonly Corridor[], lengths: Record<string, number>, total = 40_000, seed = 7): ParticleBuffers {
  const perDirection = particleBudget(corridors, lengths, total)
  const count = perDirection.reduce((a, b) => a + b * 2, 0)
  const info = new Float32Array(count * 4)
  const shape = new Float32Array(count * 4)
  const color = new Float32Array(count * 3)
  const rand = mulberry32(seed)
  let p = 0
  corridors.forEach((c, row) => {
    const n = perDirection[row]!
    const [r, g, b] = hex(MODE_COLOR[c.mode])
    for (let dir = 0; dir < 2; dir++) {
      if (c.mode === 'road') {
        for (let i = 0; i < n; i++, p++) {
          // Lanes 2..9 px either side of the centre line, busier towards the middle.
          const lane = 2 + rand() * 7 * rand()
          info.set([row, dir, rand(), rand()], p * 4)
          shape.set([lane, 1.6 + rand() * 1.8, 0, 0], p * 4)
          const warm = 0.75 + rand() * 0.25
          color.set([r, g * warm, b * warm * warm], p * 3)
        }
      } else {
        const dots = VEHICLE_DOTS[c.mode]
        const bits = Math.log2(MAX_VEHICLES)
        for (let v = 0; v < MAX_VEHICLES; v++) {
          // Bit-reversed thresholds: with k of 32 buses running, they are spread evenly along the line.
          const threshold = (bitReverse(v, bits) + 0.5) / MAX_VEHICLES
          const phase = v / MAX_VEHICLES
          for (let d = 0; d < dots; d++, p++) {
            info.set([row, dir, phase + d * 0.0016, threshold], p * 4)
            shape.set([3.5, d === 0 ? 4.2 : 3.2, 0, 0], p * 4)
            color.set([r, g, b], p * 3)
          }
        }
      }
    }
  })
  return { count, info, shape, color }
}

/**
 * Advances each direction along its line. Progress is a fraction of the line
 * per frame, so a 4 km bridge and a 40 km bus route move at their own speeds.
 * `minutesPerSecond` is how fast the map's clock runs for the particles.
 */
export function advance(
  progress: Float32Array,
  corridors: readonly Corridor[],
  readings: readonly Reading[],
  lengths: Record<string, number>,
  dtSeconds: number,
  minutesPerSecond = 1,
) {
  corridors.forEach((c, row) => {
    const reading = readings[row]
    const len = lengths[c.id] ?? 1
    for (let dir = 0; dir < 2; dir++) {
      const speed = reading?.directions?.[dir]?.speed ?? reading?.speed ?? 0
      const running = c.mode === 'road' || reading?.headway != null
      const kmPerSecond = running ? (speed / 60) * minutesPerSecond : 0
      const i = row * 2 + dir
      progress[i] = (progress[i]! + (kmPerSecond * dtSeconds) / len) % 1
    }
  })
}

/** Density for each direction: road load, or the share of vehicle slots in use. */
export function densities(corridors: readonly Corridor[], readings: readonly Reading[]): Float32Array {
  const out = new Float32Array(corridors.length * 2)
  corridors.forEach((c, row) => {
    const r = readings[row]
    for (let dir = 0; dir < 2; dir++) {
      out[row * 2 + dir] = c.mode === 'road' ? (r?.directions?.[dir]?.load ?? 0) : r?.headway == null ? 0 : Math.min(1, (r.volume ?? 0) / MAX_VEHICLES)
    }
  })
  return out
}
