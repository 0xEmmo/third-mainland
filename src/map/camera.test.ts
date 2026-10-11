import { boundsOf, clampView, fit, panBy, scaleBar, toScreen, toWorld, zoomAt, MAX_ZOOM } from './camera'

const size = { width: 1000, height: 600 }
const view = { x: 0, y: 0, zoom: 50 }

describe('camera', () => {
  it('maps the centre to the middle of the screen with north up', () => {
    expect(toScreen(view, size, [0, 0])).toEqual([500, 300])
    expect(toScreen(view, size, [1, 1])).toEqual([550, 250])
    expect(toWorld(view, size, [550, 250])).toEqual([1, 1])
  })

  it('zooms around the pointer without moving what is under it', () => {
    const next = zoomAt(view, size, 2, [800, 100])
    expect(next.zoom).toBe(100)
    const under = toWorld(view, size, [800, 100])
    const still = toScreen(next, size, under)
    expect(still[0]).toBeCloseTo(800)
    expect(still[1]).toBeCloseTo(100)
  })

  it('clamps zoom and keeps the centre inside the data', () => {
    expect(zoomAt(view, size, 1000, [0, 0]).zoom).toBe(MAX_ZOOM)
    const b = { minX: -5, minY: -5, maxX: 5, maxY: 5 }
    expect(clampView({ x: 40, y: -40, zoom: 50 }, b)).toEqual({ x: 5, y: -5, zoom: 50 })
  })

  it('pans with the finger: dragging right moves the map right', () => {
    const next = panBy(view, 100, 50)
    expect(toScreen(next, size, [0, 0])).toEqual([600, 350])
  })

  it('fits bounds into the free area beside panels', () => {
    const b = { minX: 0, minY: 0, maxX: 10, maxY: 10 }
    const v = fit(b, size, { top: 0, right: 400, bottom: 0, left: 0 })
    expect(v.zoom).toBe(60)
    const [sx] = toScreen(v, size, [5, 5])
    expect(sx).toBeCloseTo(300)
  })

  it('measures bounds and picks round scale bar lengths', () => {
    expect(
      boundsOf([
        [
          [1, 2],
          [-3, 4],
        ],
      ]),
    ).toEqual({ minX: -3, minY: 2, maxX: 1, maxY: 4 })
    expect(scaleBar(40).label).toBe('2 km')
    expect(scaleBar(400).label).toBe('200 m')
  })
})
