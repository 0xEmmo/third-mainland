import { CORRIDORS } from '../model/corridors'
import { read } from '../model/traffic'
import { advance, bitReverse, buildParticles, densities, mulberry32, particleBudget } from './flows'

const lengths = Object.fromEntries(CORRIDORS.map((c) => [c.id, 10]))

describe('particle layout', () => {
  it('spreads any prefix of bit-reversed slots evenly', () => {
    const order = Array.from({ length: 8 }, (_, i) => bitReverse(i, 3))
    expect(order).toEqual([0, 4, 2, 6, 1, 5, 3, 7])
  })

  it('is deterministic for a seed', () => {
    const a = mulberry32(1)
    const b = mulberry32(1)
    expect([a(), a()]).toEqual([b(), b()])
  })

  it('spends the budget and fills every attribute', () => {
    const p = buildParticles(CORRIDORS, lengths, 20_000)
    expect(p.count).toBeGreaterThan(19_000)
    expect(p.count).toBeLessThan(21_000)
    expect(p.info).toHaveLength(p.count * 4)
    expect(p.color).toHaveLength(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      const row = p.info[i * 4]!
      const threshold = p.info[i * 4 + 3]!
      expect(row).toBeGreaterThanOrEqual(0)
      expect(row).toBeLessThan(CORRIDORS.length)
      expect(threshold).toBeGreaterThanOrEqual(0)
      expect(threshold).toBeLessThan(1)
    }
  })

  it('gives roads particles in proportion to length', () => {
    const counts = particleBudget(CORRIDORS, { ...lengths, 'third-mainland': 20 }, 20_000)
    const bridge = counts[CORRIDORS.findIndex((c) => c.id === 'third-mainland')]!
    const ikorodu = counts[CORRIDORS.findIndex((c) => c.id === 'ikorodu-road')]!
    expect(bridge / ikorodu).toBeCloseTo(2, 1)
  })
})

describe('per-frame state', () => {
  const readings = CORRIDORS.map((c) => read(c, 10, 7.6, 'weekday'))

  it('moves slow roads less than fast ones and wraps at the end', () => {
    const progress = new Float32Array(CORRIDORS.length * 2)
    advance(progress, CORRIDORS, readings, lengths, 1)
    const bridge = CORRIDORS.findIndex((c) => c.id === 'third-mainland')
    // Southbound is jammed at 07:36, northbound is not.
    expect(progress[bridge * 2]!).toBeLessThan(progress[bridge * 2 + 1]!)
    progress.fill(0.99)
    advance(progress, CORRIDORS, readings, lengths, 1)
    expect(Math.max(...progress)).toBeLessThan(1)
  })

  it('stops transit that is not running', () => {
    const night = CORRIDORS.map((c) => read(c, 10, 23.5, 'weekday'))
    const progress = new Float32Array(CORRIDORS.length * 2)
    advance(progress, CORRIDORS, night, lengths, 1)
    const brt = CORRIDORS.findIndex((c) => c.id === 'brt-ikorodu')
    expect(progress[brt * 2]).toBe(0)
    expect(densities(CORRIDORS, night)[brt * 2]).toBe(0)
  })

  it('reports density in 0..1', () => {
    for (const d of densities(CORRIDORS, readings)) {
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(1)
    }
  })
})
