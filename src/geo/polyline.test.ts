import { removeSpurs, cumulative, distanceToLine, length, pointAt, resample, simplify } from './polyline'
import type { Point } from './project'

const L: Point[] = [
  [0, 0],
  [3, 0],
  [3, 4],
]

describe('polyline', () => {
  it('measures length and cumulative distance', () => {
    expect(length(L)).toBe(7)
    expect(cumulative(L)).toEqual([0, 3, 7])
  })

  it('finds points by distance, clamping out-of-range t', () => {
    expect(pointAt(L, 0)).toEqual([0, 0])
    expect(pointAt(L, 3 / 7)).toEqual([3, 0])
    expect(pointAt(L, 5 / 7)[1]).toBeCloseTo(2)
    expect(pointAt(L, 2)).toEqual([3, 4])
    expect(pointAt(L, -1)).toEqual([0, 0])
  })

  it('resamples at even spacing', () => {
    const r = resample(L, 8)
    expect(r).toHaveLength(8)
    expect(r[0]).toEqual([0, 0])
    expect(r[7]).toEqual([3, 4])
    expect(r[3]![0]).toBeCloseTo(3)
  })

  it('measures distance from a point to the nearest segment', () => {
    expect(distanceToLine([1, 1], L)).toBeCloseTo(1)
    expect(distanceToLine([4, 2], L)).toBeCloseTo(1)
    expect(distanceToLine([-3, -4], L)).toBeCloseTo(5)
  })

  it('drops points that sit within tolerance of a straight line', () => {
    const wobbly: Point[] = [
      [0, 0],
      [1, 0.01],
      [2, -0.01],
      [3, 0],
      [3, 4],
    ]
    expect(simplify(wobbly, 0.05)).toEqual([
      [0, 0],
      [3, 0],
      [3, 4],
    ])
    expect(simplify(wobbly, 0.001)).toHaveLength(5)
  })
})

describe('removeSpurs', () => {
  it('cuts an out-and-back spur and a small loop', () => {
    const spur: Point[] = [
      [0, 0],
      [1, 0],
      [1, 0.5],
      [1, 1],
      [1, 0.5],
      [1.001, 0],
      [2, 0],
    ]
    expect(removeSpurs(spur, 0.01, 0.5)).toEqual([
      [0, 0],
      [1, 0],
      [1.001, 0],
      [2, 0],
    ])
  })

  it('leaves a line that never doubles back alone', () => {
    expect(removeSpurs(L, 0.01)).toEqual(L)
  })
})
