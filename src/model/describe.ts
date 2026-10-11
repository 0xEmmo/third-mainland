import type { Corridor, Reading, Scenario, Sort } from './types'
import { formatClock, formatMinutes, formatSpeed, period, dayName } from './time'

export const MODE_NAME: Record<Corridor['mode'], string> = {
  road: 'Road traffic',
  brt: 'BRT',
  ferry: 'Ferry',
  rail: 'Rail',
}

/** "Oworonshoki to Adeniji" or "Bus every 3 min" for the list's second line. */
export function subtitle(c: Corridor, r: Reading | undefined, hour: number): string {
  if (c.mode === 'road' || !r) return `${c.from} to ${c.to}`
  if (r.headway == null) {
    const next = r.next
    return next != null && next > hour ? `First ${vehicle(c)} ${formatClock(next)}` : `Not running · resumes ${formatClock(c.hours[0])}`
  }
  if (c.mode === 'ferry' && r.next != null) return `Next boat ${formatClock(r.next)}`
  return `${c.mode === 'rail' ? 'Train' : 'Bus'} every ${r.headway} min${c.mode === 'brt' ? ' · own lane' : ''}`
}

export const vehicle = (c: Corridor) => (c.mode === 'ferry' ? 'boat' : c.mode === 'rail' ? 'train' : 'bus')

/** The row label for a corridor, with direction when it matters. */
export function title(c: Corridor, r: Reading | undefined): string {
  if (c.mode === 'road' && r?.slowDirection !== undefined) return `${c.name}, ${shortDirection(c.directions[r.slowDirection])}`
  return c.name
}

function shortDirection(d: string) {
  // "southbound" reads fine as "south"; "inbound" does not survive the same trim.
  return /^(north|south|east|west)bound$/.test(d) ? d.replace(/bound$/, '') : d.replace(/^to the /, 'to ')
}

export function sortCorridors(corridors: readonly Corridor[], readings: readonly Reading[], sort: Sort): Corridor[] {
  const byId = new Map(readings.map((r) => [r.id, r]))
  const list = [...corridors]
  if (sort === 'az') return list.sort((a, b) => a.name.localeCompare(b.name))
  const running = (c: Corridor) => byId.get(c.id)?.level !== 2 || c.mode === 'road'
  if (sort === 'slowest') return list.sort((a, b) => Number(running(b)) - Number(running(a)) || (byId.get(a.id)?.speed ?? 0) - (byId.get(b.id)?.speed ?? 0))
  return list.sort((a, b) => (byId.get(b.id)?.load ?? 0) - (byId.get(a.id)?.load ?? 0))
}

/** A sentence for screen readers describing the whole map right now. */
export function summarise(corridors: readonly Corridor[], readings: readonly Reading[], hour: number, scenario: Scenario): string {
  const roads = corridors.filter((c) => c.mode === 'road')
  const byId = new Map(readings.map((r) => [r.id, r]))
  const slowest = [...roads].sort((a, b) => (byId.get(a.id)?.speed ?? 0) - (byId.get(b.id)?.speed ?? 0))[0]
  const r = slowest && byId.get(slowest.id)
  const jammed = roads.filter((c) => byId.get(c.id)?.level === 2).length
  const transitOff = corridors.filter((c) => c.mode !== 'road' && byId.get(c.id)?.level === 2).length
  const parts = [`${formatClock(hour)}, ${dayName(scenario)}, ${period(hour)}.`]
  if (slowest && r) parts.push(`Slowest road: ${title(slowest, r)} at ${formatSpeed(r.speed)}, ${formatMinutes(r.minutes)} end to end.`)
  parts.push(jammed === 0 ? 'No roads are jammed.' : `${jammed} of ${roads.length} roads are jammed.`)
  if (transitOff) parts.push(`${transitOff} transit lines are not running.`)
  return parts.join(' ')
}

export type Status = { label: string; tone: 'ok' | 'slow' | 'jam' | 'off' }

export function status(c: Corridor, r: Reading | undefined): Status {
  if (!r) return { label: '', tone: 'off' }
  if (c.mode !== 'road') return r.level === 2 ? { label: 'Not running', tone: 'off' } : { label: 'Running', tone: 'ok' }
  return r.level === 2 ? { label: 'Jammed', tone: 'jam' } : r.level === 1 ? { label: 'Slow', tone: 'slow' } : { label: 'Flowing', tone: 'ok' }
}
