import { Graph } from './graph'
import { project, unproject } from './project'

describe('graph', () => {
  it('finds the cheapest path, honouring edge weights', () => {
    const g = new Graph()
    const a = g.node(1, [0, 0])
    const b = g.node(2, [1, 0])
    const c = g.node(3, [2, 0])
    const d = g.node(4, [1, 1])
    g.link(a, b)
    g.link(b, c)
    g.link(a, d, 0.1)
    g.link(d, c, 0.1)
    expect(g.path(a, c)).toEqual([a, d, c])
  })

  it('respects one-way links', () => {
    const g = new Graph()
    const a = g.node(1, [0, 0])
    const b = g.node(2, [1, 0])
    const c = g.node(3, [0, 1])
    g.link(a, b, 1, 1)
    g.link(b, c, 1, -1)
    g.link(c, a)
    expect(g.path(a, b)).toEqual([a, b])
    expect(g.path(b, a)).toBeNull()
    expect(g.path(c, b)).toEqual([c, b])
    expect(g.path(b, c)).toBeNull()
  })

  it('reuses nodes shared between ways and reports unreachable ends', () => {
    const g = new Graph()
    expect(g.node(7, [0, 0])).toBe(g.node(7, [9, 9]))
    const lonely = g.node(8, [5, 5])
    const other = g.node(9, [6, 6])
    expect(g.path(lonely, other)).toBeNull()
  })

  it('snaps to the nearest connected node', () => {
    const g = new Graph()
    const a = g.node(1, [0, 0])
    const b = g.node(2, [10, 0])
    g.node(3, [4.9, 0])
    g.link(a, b)
    expect(g.nearest([4.9, 0])).toBe(a)
  })
})

describe('projection', () => {
  it('round-trips and puts one unit at about a kilometre', () => {
    const [x, y] = project(3.41, 6.51)
    expect(x).toBeCloseTo(1.106, 2)
    expect(y).toBeCloseTo(1.106, 2)
    const back = unproject([x, y])
    expect(back.lon).toBeCloseTo(3.41, 9)
    expect(back.lat).toBeCloseTo(6.51, 9)
  })
})
