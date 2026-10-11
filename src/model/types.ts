export type Mode = 'road' | 'brt' | 'rail' | 'ferry'

export type Scenario = 'weekday' | 'saturday' | 'rain'

/** [lat, lon], the order people copy out of a map. */
export type LatLon = readonly [lat: number, lon: number]

interface CorridorBase {
  id: string
  name: string
  mode: Mode
  /** Plain-language ends, shown under the name. */
  from: string
  to: string
  /** Where the line is traced through, in order. The build script snaps these to OSM nodes. */
  via: readonly LatLon[]
  /** OSM way names to prefer when tracing between the via points. */
  prefer?: readonly string[]
  note?: string
}

export interface RoadCorridor extends CorridorBase {
  mode: 'road'
  /** Names for the two directions, forward first (the direction of `via`). */
  directions: readonly [string, string]
  /** Free-flow speed in km/h. */
  freeFlow: number
  /** Vehicles per 10 minutes per direction before the road starts to choke. */
  capacity: number
  /**
   * Demand as a share of capacity. `am` and `pm` are the heights of the two
   * rush-hour peaks for [forward, back]; `base` is the daytime floor.
   */
  demand: { base: number; am: readonly [number, number]; pm: readonly [number, number]; midday: number }
}

export interface TransitCorridor extends CorridorBase {
  mode: 'brt' | 'rail' | 'ferry'
  /** Average running speed in km/h, stops included. */
  speed: number
  /** Minutes between departures in the peak and the rest of the day. */
  headway: { peak: number; offPeak: number }
  /** Service hours as decimal hours, e.g. [5.5, 22]. */
  hours: readonly [number, number]
  /** The OSM ferry way the boat follows, for ferries. */
  osmWay?: number
  /** Which OSM railway tag to trace along, for rail lines. */
  rail?: 'subway' | 'rail'
  /** Fixed departure times from the first stop, for ferries. Decimal hours. */
  departures?: readonly number[]
}

export type Corridor = RoadCorridor | TransitCorridor

/** What the model says about one corridor at one moment. */
export interface Reading {
  id: string
  mode: Mode
  /** km/h in the slower (or only) direction. */
  speed: number
  /** Minutes end to end at that speed. */
  minutes: number
  /** Road: vehicles per 10 min in the busier direction. Transit: vehicles running. */
  volume: number
  /** 0..1, how full the corridor looks on the map. */
  load: number
  /** 0 = flowing, 1 = slow, 2 = jammed (roads); 0 = running, 2 = not running (transit). */
  level: 0 | 1 | 2
  /** Road: which direction is slower. */
  slowDirection?: 0 | 1
  /** Per-direction numbers for roads. */
  directions?: readonly [DirectionReading, DirectionReading]
  /** Transit: minutes between departures, or null when not running. */
  headway?: number | null
  /** Transit: next departure as decimal hours, or null. */
  next?: number | null
}

export interface DirectionReading {
  speed: number
  minutes: number
  volume: number
  load: number
}

export type Sort = 'slowest' | 'busiest' | 'az'
