import { midpoint, pick } from './pick'

const items = [
  {
    id: 'a',
    visible: true,
    line: [
      [0, 0],
      [10, 0],
    ] as [number, number][],
  },
  {
    id: 'b',
    visible: true,
    line: [
      [0, 1],
      [10, 1],
    ] as [number, number][],
  },
  {
    id: 'hidden',
    visible: false,
    line: [
      [0, 0.5],
      [10, 0.5],
    ] as [number, number][],
  },
]

describe('pick', () => {
  it('picks the nearest visible line inside the radius', () => {
    expect(pick([5, 0.3], items, 0.4)).toBe('a')
    expect(pick([5, 0.7], items, 0.4)).toBe('b')
    expect(pick([5, 0.5], items, 0.1)).toBeNull()
    expect(pick([5, 5], items, 0.4)).toBeNull()
  })

  it('finds the halfway point by distance, not by vertex count', () => {
    expect(
      midpoint([
        [0, 0],
        [1, 0],
        [2, 0],
        [10, 0],
      ]),
    ).toEqual([5, 0])
  })
})
