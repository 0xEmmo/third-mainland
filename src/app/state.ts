import type { Mode, Scenario } from '../model/types'
import { wrapHour } from '../model/time'

export type Sort = 'slowest' | 'busiest' | 'az'
export type Rate = 1 | 10

export interface AppState {
  hour: number
  playing: boolean
  scenario: Scenario
  /** Map minutes per real second. */
  rate: Rate
  layers: Record<Mode, boolean>
  selected: string | null
  sort: Sort
  /** Whether the flows move. Starts from prefers-reduced-motion; the user can override it. */
  motion: boolean
  table: boolean
}

export type Action =
  | { type: 'setHour'; hour: number }
  | { type: 'nudge'; minutes: number }
  | { type: 'play'; playing: boolean }
  | { type: 'scenario'; scenario: Scenario }
  | { type: 'rate'; rate: Rate }
  | { type: 'layer'; mode: Mode; on: boolean }
  | { type: 'select'; id: string | null }
  | { type: 'sort'; sort: Sort }
  | { type: 'motion'; on: boolean }
  | { type: 'table'; on: boolean }

export const initialState = (reducedMotion: boolean): AppState => ({
  hour: 7 + 40 / 60,
  playing: !reducedMotion,
  scenario: 'weekday',
  rate: 1,
  layers: { road: true, brt: true, ferry: true, rail: true },
  selected: 'third-mainland',
  sort: 'slowest',
  motion: !reducedMotion,
  table: false,
})

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setHour':
      return { ...state, hour: wrapHour(action.hour) }
    case 'nudge':
      return { ...state, hour: wrapHour(state.hour + action.minutes / 60) }
    case 'play':
      return { ...state, playing: action.playing }
    case 'scenario':
      return { ...state, scenario: action.scenario }
    case 'rate':
      return { ...state, rate: action.rate }
    case 'layer': {
      const layers = { ...state.layers, [action.mode]: action.on }
      return { ...state, layers }
    }
    case 'select':
      return { ...state, selected: action.id }
    case 'sort':
      return { ...state, sort: action.sort }
    case 'motion':
      return { ...state, motion: action.on, playing: action.on ? state.playing : false }
    case 'table':
      return { ...state, table: action.on }
  }
}

const KEY = 'third-mainland:v1'
const PERSISTED = ['hour', 'scenario', 'rate', 'layers', 'selected', 'sort', 'table'] as const

export function save(state: AppState, storage: Pick<Storage, 'setItem'> = localStorage) {
  const picked = Object.fromEntries(PERSISTED.map((k) => [k, state[k]]))
  try {
    storage.setItem(KEY, JSON.stringify(picked))
  } catch {
    // Private mode or a full disk: the map still works, it just won't remember.
  }
}

const SCENARIOS: readonly Scenario[] = ['weekday', 'saturday', 'rain']
const SORTS: readonly Sort[] = ['slowest', 'busiest', 'az']

/** Reads saved state, ignoring anything malformed or from an older shape. */
export function restore(base: AppState, knownIds: ReadonlySet<string>, storage: Pick<Storage, 'getItem'> = localStorage): AppState {
  let raw: unknown
  try {
    raw = JSON.parse(storage.getItem(KEY) ?? 'null')
  } catch {
    return base
  }
  if (!raw || typeof raw !== 'object') return base
  const s = raw as Partial<Record<keyof AppState, unknown>>
  const next = { ...base }
  if (typeof s.hour === 'number' && Number.isFinite(s.hour)) next.hour = wrapHour(s.hour)
  if (SCENARIOS.includes(s.scenario as Scenario)) next.scenario = s.scenario as Scenario
  if (s.rate === 1 || s.rate === 10) next.rate = s.rate
  if (SORTS.includes(s.sort as Sort)) next.sort = s.sort as Sort
  if (s.selected === null || (typeof s.selected === 'string' && knownIds.has(s.selected))) next.selected = s.selected as string | null
  if (typeof s.table === 'boolean') next.table = s.table
  if (s.layers && typeof s.layers === 'object') {
    const l = s.layers as Record<string, unknown>
    next.layers = { ...base.layers }
    for (const m of Object.keys(base.layers) as Mode[]) if (typeof l[m] === 'boolean') next.layers[m] = l[m] as boolean
  }
  return next
}
