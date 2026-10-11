import { assembleRings, pointInRing, signedArea } from './rings'
import type { Point } from './project'

const square: Point[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
]

describe('rings', () => {
  it('joins loose and reversed ways into one closed ring', () => {
    const parts: Point[][] = [
      [
        [1, 1],
        [0, 1],
        [0, 0],
      ],
      [
        [1, 0],
        [0, 0],
      ],
      [
        [1, 0],
        [1, 1],
      ],
    ]
    const { rings, open } = assembleRings(parts)
    expect(open).toEqual([])
    expect(rings).toHaveLength(1)
    expect(rings[0]).toHaveLength(5)
    expect(Math.abs(signedArea(rings[0]!))).toBeCloseTo(1)
  })

  it('reports chains that never close', () => {
    const { rings, open } = assembleRings([
      [
        [0, 0],
        [1, 0],
      ],
      [
        [5, 5],
        [6, 6],
      ],
    ])
    expect(rings).toEqual([])
    expect(open).toHaveLength(2)
  })

  it('knows winding and containment', () => {
    expect(signedArea(square)).toBeCloseTo(1)
    expect(signedArea([...square].reverse())).toBeCloseTo(-1)
    expect(pointInRing([0.5, 0.5], square)).toBe(true)
    expect(pointInRing([1.5, 0.5], square)).toBe(false)
  })
})
