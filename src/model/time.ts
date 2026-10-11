import type { Scenario } from './types'

export const DAY = 24

export const wrapHour = (h: number) => ((h % DAY) + DAY) % DAY

/** 7.6667 → "07:40". Rounds to the nearest minute. */
export function formatClock(hour: number): string {
  const total = Math.round(wrapHour(hour) * 60) % (DAY * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "07:40" → 7.6667. Accepts "7:40" and "0740". Returns null for anything else. */
export function parseClock(text: string): number | null {
  const match = /^\s*(\d{1,2}):?(\d{2})\s*$/.exec(text)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h > 23 || m > 59) return null
  return h + m / 60
}

export function period(hour: number): string {
  const h = wrapHour(hour)
  if (h < 5) return 'small hours'
  if (h < 6.5) return 'early morning'
  if (h < 10) return 'morning peak'
  if (h < 16) return 'midday'
  if (h < 20) return 'evening peak'
  return 'late evening'
}

export function dayName(scenario: Scenario): string {
  if (scenario === 'saturday') return 'Saturday'
  if (scenario === 'rain') return 'Monday, heavy rain'
  return 'Monday'
}

export const PRESETS = [
  { id: 'morning', label: 'Morning peak', hour: 7 + 40 / 60 },
  { id: 'midday', label: 'Midday', hour: 13 },
  { id: 'evening', label: 'Evening peak', hour: 18.5 },
  { id: 'night', label: 'Night', hour: 23.5 },
] as const

/** Minutes as "48 min" or "1 h 12 min". */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

export const formatSpeed = (kmh: number) => `${Math.round(kmh)} km/h`
