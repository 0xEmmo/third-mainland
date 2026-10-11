import { initialState, reducer, restore, save } from './state'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}
const ids = new Set(['third-mainland', 'eko-bridge'])

describe('app state', () => {
  it('starts paused and still when the user prefers reduced motion', () => {
    expect(initialState(true)).toMatchObject({ playing: false, motion: false })
    expect(initialState(false)).toMatchObject({ playing: true, motion: true })
  })

  it('wraps the clock around midnight', () => {
    const s = reducer(initialState(false), { type: 'setHour', hour: 23.9 })
    expect(reducer(s, { type: 'nudge', minutes: 15 }).hour).toBeCloseTo(0.15)
    expect(reducer(s, { type: 'setHour', hour: -1 }).hour).toBe(23)
  })

  it('pauses when motion is switched off', () => {
    const s = reducer(initialState(false), { type: 'motion', on: false })
    expect(s.playing).toBe(false)
  })

  it('round-trips what it should remember, and not the play state', () => {
    const store = memory()
    let s = initialState(false)
    s = reducer(s, { type: 'scenario', scenario: 'rain' })
    s = reducer(s, { type: 'layer', mode: 'ferry', on: false })
    s = reducer(s, { type: 'select', id: 'eko-bridge' })
    s = reducer(s, { type: 'play', playing: false })
    save(s, store)
    const back = restore(initialState(false), ids, store)
    expect(back).toMatchObject({ scenario: 'rain', selected: 'eko-bridge', playing: true })
    expect(back.layers.ferry).toBe(false)
    expect(back.layers.road).toBe(true)
  })

  it('ignores junk and corridors that no longer exist', () => {
    const store = memory()
    store.setItem('third-mainland:v1', JSON.stringify({ hour: 'noon', scenario: 'monsoon', selected: 'old-road', rate: 3, layers: { road: 'yes' } }))
    expect(restore(initialState(false), ids, store)).toEqual(initialState(false))
    store.setItem('third-mainland:v1', '{nope')
    expect(restore(initialState(false), ids, store)).toEqual(initialState(false))
  })
})
