import type { Corridor, DirectionReading, Reading, RoadCorridor, Scenario, TransitCorridor } from './types'

/**
 * Speed from demand uses the BPR curve transport planners have used since the
 * 1960s: speed = freeFlow / (1 + α·(v/c)^β). The textbook α of 0.15 is far too
 * kind to Lagos, so α is pushed to 1, which turns a bridge at 140% of capacity
 * into the 14 km/h crawl anyone on it at 07:40 would recognise.
 */
const ALPHA = 1
const BETA = 4

interface ScenarioFactors {
  demand: number
  capacity: number
  freeFlow: number
  am: number
  pm: number
  midday: number
  middayPeak: number
  transitSpeed: Record<TransitCorridor['mode'], number>
  headway: number
  /** Ferries keep every nth departure. */
  ferryEvery: number
}

export const SCENARIOS: Record<Scenario, ScenarioFactors> = {
  weekday: {
    demand: 1,
    capacity: 1,
    freeFlow: 1,
    am: 1,
    pm: 1,
    midday: 1,
    middayPeak: 13.5,
    transitSpeed: { brt: 1, rail: 1, ferry: 1 },
    headway: 1,
    ferryEvery: 1,
  },
  saturday: {
    demand: 0.9,
    capacity: 1,
    freeFlow: 1,
    am: 0.3,
    pm: 0.55,
    midday: 3.2,
    middayPeak: 12.5,
    transitSpeed: { brt: 1.05, rail: 1, ferry: 1 },
    headway: 1.6,
    ferryEvery: 2,
  },
  rain: {
    demand: 1.04,
    capacity: 0.87,
    freeFlow: 0.85,
    am: 1.05,
    pm: 1,
    midday: 1,
    middayPeak: 13.5,
    transitSpeed: { brt: 0.88, rail: 1, ferry: 0.75 },
    headway: 1.25,
    ferryEvery: 2,
  },
}

export const SCENARIO_LABEL: Record<Scenario, string> = {
  weekday: 'Weekday',
  saturday: 'Saturday',
  rain: 'Rain day',
}

const gauss = (t: number, mu: number, sigma: number) => Math.exp(-((t - mu) ** 2) / (2 * sigma * sigma))
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

/** 0.12 in the dead of night, 1 through the working day. */
export function dayEnvelope(hour: number): number {
  const h = ((hour % 24) + 24) % 24
  const morning = sigmoid((h - 5.4) * 2.4)
  const evening = sigmoid((23 - h) * 1.4)
  return 0.12 + 0.88 * morning * evening
}

/** Demand as a share of capacity for one direction of a road. */
export function demandRatio(c: RoadCorridor, direction: 0 | 1, hour: number, scenario: Scenario): number {
  const s = SCENARIOS[scenario]
  const { base, am, pm, midday } = c.demand
  const value =
    base * dayEnvelope(hour) +
    am[direction] * s.am * gauss(hour, 7.6, 1.05) +
    pm[direction] * s.pm * gauss(hour, 18.3, 1.45) +
    midday * s.midday * gauss(hour, s.middayPeak, 2.2)
  return value * s.demand
}

export function roadDirection(c: RoadCorridor, lengthKm: number, direction: 0 | 1, hour: number, scenario: Scenario): DirectionReading {
  const s = SCENARIOS[scenario]
  const x = demandRatio(c, direction, hour, scenario) / s.capacity
  const speed = (c.freeFlow * s.freeFlow) / (1 + ALPHA * x ** BETA)
  return {
    speed,
    minutes: (lengthKm / speed) * 60,
    volume: Math.round(Math.min(x, 1) * c.capacity * s.capacity),
    load: Math.min(1, Math.max(0.04, x / 1.25)),
  }
}

export function readRoad(c: RoadCorridor, lengthKm: number, hour: number, scenario: Scenario): Reading {
  const dirs = [roadDirection(c, lengthKm, 0, hour, scenario), roadDirection(c, lengthKm, 1, hour, scenario)] as const
  const slow: 0 | 1 = dirs[1].speed < dirs[0].speed ? 1 : 0
  const worst = dirs[slow]
  const ratio = worst.speed / c.freeFlow
  return {
    id: c.id,
    mode: 'road',
    speed: worst.speed,
    minutes: worst.minutes,
    volume: Math.max(dirs[0].volume, dirs[1].volume),
    load: Math.max(dirs[0].load, dirs[1].load),
    level: ratio < 0.3 ? 2 : ratio < 0.6 ? 1 : 0,
    slowDirection: slow,
    directions: dirs,
  }
}

const isPeak = (hour: number) => (hour >= 6.5 && hour < 10) || (hour >= 16 && hour < 20)

/** The departures that actually sail under this scenario. */
export function departures(c: TransitCorridor, scenario: Scenario): number[] {
  const every = SCENARIOS[scenario].ferryEvery
  return (c.departures ?? []).filter((_, i) => i % every === 0)
}

export function headwayAt(c: TransitCorridor, hour: number, scenario: Scenario): number | null {
  const h = ((hour % 24) + 24) % 24
  if (h < c.hours[0] || h >= c.hours[1]) return null
  const list = departures(c, scenario)
  if (list.length) {
    const i = list.findIndex((d) => d >= h)
    if (i < 0) return null
    const gap = i > 0 ? list[i]! - list[i - 1]! : list.length > 1 ? list[1]! - list[0]! : 1
    return Math.round(gap * 60)
  }
  const s = SCENARIOS[scenario]
  const base = scenario === 'weekday' && isPeak(h) ? c.headway.peak : c.headway.offPeak
  return Math.round(base * s.headway)
}

export function nextDeparture(c: TransitCorridor, hour: number, scenario: Scenario): number | null {
  const h = ((hour % 24) + 24) % 24
  const list = departures(c, scenario)
  if (list.length) return list.find((d) => d >= h - 1e-9) ?? null
  const headway = headwayAt(c, h, scenario)
  if (headway === null) return h < c.hours[0] ? c.hours[0] : null
  const sinceStart = (h - c.hours[0]) * 60
  return c.hours[0] + (Math.ceil(sinceStart / headway - 1e-9) * headway) / 60
}

export function readTransit(c: TransitCorridor, lengthKm: number, hour: number, scenario: Scenario): Reading {
  const s = SCENARIOS[scenario]
  // Buses share junctions with everyone else, so they feel the rush hour a little.
  const rush = c.mode === 'brt' ? 0.18 * Math.max(gauss(hour, 7.6, 1.05) * s.am, gauss(hour, 18.3, 1.45) * s.pm) : 0
  const speed = c.speed * s.transitSpeed[c.mode] * (1 - rush)
  const minutes = (lengthKm / speed) * 60
  const headway = headwayAt(c, hour, scenario)
  const running = headway === null ? 0 : Math.max(1, Math.round(minutes / headway))
  return {
    id: c.id,
    mode: c.mode,
    speed,
    minutes,
    volume: running,
    load: headway === null ? 0 : Math.min(1, running / MAX_VEHICLES),
    level: headway === null ? 2 : 0,
    headway,
    next: nextDeparture(c, hour, scenario),
  }
}

/** Vehicle slots each transit line gets on the GPU, per direction. */
export const MAX_VEHICLES = 32

export function read(c: Corridor, lengthKm: number, hour: number, scenario: Scenario): Reading {
  return c.mode === 'road' ? readRoad(c, lengthKm, hour, scenario) : readTransit(c, lengthKm, hour, scenario)
}

/** City-wide road load through the day, for the histogram under the slider. */
export function dayProfile(corridors: readonly Corridor[], scenario: Scenario, bins = 96): number[] {
  const roads = corridors.filter((c): c is RoadCorridor => c.mode === 'road')
  const raw = Array.from({ length: bins }, (_, i) => {
    const hour = ((i + 0.5) / bins) * 24
    return roads.reduce((sum, c) => sum + demandRatio(c, 0, hour, scenario) + demandRatio(c, 1, hour, scenario), 0)
  })
  const max = Math.max(...raw, 1e-9)
  return raw.map((v) => v / max)
}

/** Readings for each road at intervals through the day, for sparklines. */
export function speedProfile(c: Corridor, lengthKm: number, scenario: Scenario, points = 48): number[] {
  return Array.from({ length: points }, (_, i) => read(c, lengthKm, (i / points) * 24, scenario).speed)
}
