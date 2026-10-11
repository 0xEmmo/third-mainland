import { CORRIDORS } from './corridors'
import { dayEnvelope, dayProfile, demandRatio, departures, headwayAt, nextDeparture, read, readRoad, readTransit } from './traffic'
import type { RoadCorridor, TransitCorridor } from './types'

const bridge = CORRIDORS.find((c) => c.id === 'third-mainland') as RoadCorridor
const brt = CORRIDORS.find((c) => c.id === 'brt-ikorodu') as TransitCorridor
const ferry: TransitCorridor = {
  id: 'test-ferry',
  name: 'Test ferry',
  mode: 'ferry',
  from: 'A',
  to: 'B',
  via: [],
  speed: 30,
  headway: { peak: 30, offPeak: 60 },
  hours: [6.5, 19.5],
  departures: [6.5, 7, 7.5, 8, 9, 10],
}

describe('road model', () => {
  it('crawls southbound on the bridge at 07:40 on a weekday', () => {
    const r = readRoad(bridge, 11.8, 7 + 40 / 60, 'weekday')
    expect(r.slowDirection).toBe(0)
    expect(r.speed).toBeGreaterThan(10)
    expect(r.speed).toBeLessThan(18)
    expect(r.level).toBe(2)
    expect(r.minutes).toBeGreaterThan(40)
  })

  it('flips the slow direction for the evening rush', () => {
    expect(readRoad(bridge, 11.8, 18.5, 'weekday').slowDirection).toBe(1)
  })

  it('runs near free flow in the small hours', () => {
    const r = readRoad(bridge, 11.8, 3, 'weekday')
    expect(r.speed).toBeGreaterThan(75)
    expect(r.level).toBe(0)
    expect(r.load).toBeLessThan(0.15)
  })

  it('makes rain worse and Saturday mornings easier', () => {
    const at = 7.6
    const weekday = readRoad(bridge, 11.8, at, 'weekday').speed
    expect(readRoad(bridge, 11.8, at, 'rain').speed).toBeLessThan(weekday)
    expect(readRoad(bridge, 11.8, at, 'saturday').speed).toBeGreaterThan(weekday * 2)
  })

  it('peaks Saturday demand around midday instead of the morning', () => {
    const noon = demandRatio(bridge, 0, 12.5, 'saturday')
    expect(noon).toBeGreaterThan(demandRatio(bridge, 0, 7.6, 'saturday'))
  })

  it('caps volume at capacity and keeps load in 0..1', () => {
    for (let h = 0; h < 24; h += 0.5) {
      const r = readRoad(bridge, 11.8, h, 'rain')
      expect(r.volume).toBeLessThanOrEqual(bridge.capacity)
      expect(r.load).toBeGreaterThan(0)
      expect(r.load).toBeLessThanOrEqual(1)
    }
  })

  it('has a quiet night and a busy day', () => {
    expect(dayEnvelope(3)).toBeLessThan(0.2)
    expect(dayEnvelope(12)).toBeGreaterThan(0.95)
    expect(dayEnvelope(27)).toBeCloseTo(dayEnvelope(3))
  })
})

describe('transit model', () => {
  it('runs buses every 3 minutes in the weekday peak and stops at night', () => {
    expect(headwayAt(brt, 7.6, 'weekday')).toBe(3)
    expect(headwayAt(brt, 13, 'weekday')).toBe(8)
    expect(headwayAt(brt, 13, 'saturday')).toBe(13)
    expect(headwayAt(brt, 23, 'weekday')).toBeNull()
    expect(readTransit(brt, 32, 23, 'weekday').level).toBe(2)
  })

  it('works out the next bus on the headway grid', () => {
    expect(nextDeparture(brt, 5.5, 'weekday')).toBeCloseTo(5.5)
    expect(nextDeparture(brt, 4, 'weekday')).toBe(5.5)
    expect(nextDeparture(brt, 23, 'weekday')).toBeNull()
    const n = nextDeparture(brt, 7.61, 'weekday')!
    expect(n).toBeGreaterThanOrEqual(7.61)
    expect(n - 7.61).toBeLessThanOrEqual(3 / 60)
  })

  it('slows the bus a little in the rush, even in its own lane', () => {
    expect(readTransit(brt, 32, 7.6, 'weekday').speed).toBeLessThan(readTransit(brt, 32, 13, 'weekday').speed)
  })

  it('reads ferry departures from the timetable and thins them in the rain', () => {
    expect(nextDeparture(ferry, 7.1, 'weekday')).toBe(7.5)
    expect(nextDeparture(ferry, 7, 'weekday')).toBe(7)
    expect(nextDeparture(ferry, 10.5, 'weekday')).toBeNull()
    expect(departures(ferry, 'rain')).toEqual([6.5, 7.5, 9])
    expect(headwayAt(ferry, 8.5, 'weekday')).toBe(60)
    expect(headwayAt(ferry, 11, 'weekday')).toBeNull()
  })

  it('counts vehicles in service from travel time and headway', () => {
    const r = readTransit(brt, 27, 13, 'weekday')
    expect(r.minutes).toBeCloseTo(60, 0)
    expect(r.volume).toBe(Math.round(r.minutes / 8))
  })
})

describe('day profile', () => {
  it('normalises to 1 and has two weekday peaks', () => {
    const p = dayProfile(CORRIDORS, 'weekday')
    expect(Math.max(...p)).toBe(1)
    const at = (h: number) => p[Math.floor((h / 24) * p.length)]!
    expect(at(7.6)).toBeGreaterThan(at(12))
    expect(at(18.3)).toBeGreaterThan(at(12))
    expect(at(3)).toBeLessThan(0.25)
  })

  it('reads every corridor without throwing', () => {
    for (const c of CORRIDORS) expect(Number.isFinite(read(c, 10, 9, 'weekday').speed)).toBe(true)
  })
})
