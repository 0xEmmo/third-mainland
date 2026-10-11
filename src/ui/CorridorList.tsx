import type { Corridor, Mode, Reading, Sort } from '../model/types'
import { sortCorridors, subtitle, title } from '../model/describe'
import { formatClock, formatMinutes, formatSpeed } from '../model/time'
import { MODE_COLOR } from '../map/flows'
import { Radios } from './Radios'
import { Sparkline } from './Sparkline'
import './panels.css'

interface Props {
  corridors: readonly Corridor[]
  readings: readonly Reading[]
  profiles: Record<string, number[]>
  hour: number
  layers: Record<Mode, boolean>
  selected: string | null
  sort: Sort
  onSort: (s: Sort) => void
  onSelect: (id: string) => void
  onShowAll: () => void
}

const SORTS = [
  { value: 'slowest', label: 'Slowest' },
  { value: 'busiest', label: 'Busiest' },
  { value: 'az', label: 'A–Z' },
] as const

export function CorridorList({ corridors, readings, profiles, hour, layers, selected, sort, onSort, onSelect, onShowAll }: Props) {
  const byId = new Map(readings.map((r) => [r.id, r]))
  const visible = sortCorridors(
    corridors.filter((c) => layers[c.mode]),
    readings,
    sort,
  )
  const hidden = corridors.length - visible.length
  return (
    <section className="routes" aria-labelledby="routes-h">
      <div className="routes-h">
        <h2 id="routes-h">
          Corridors at <span className="mono">{formatClock(hour)}</span>
        </h2>
        <Radios legend="Sort corridors" value={sort} options={SORTS} onChange={onSort} variant="segments" />
      </div>
      {visible.length === 0 ? (
        <div className="routes-empty">
          <p>Every layer is switched off, so there is nothing to list.</p>
          <button type="button" className="chip" onClick={onShowAll}>
            Show all layers
          </button>
        </div>
      ) : (
        <ul className="routes-list">
          {visible.map((c) => {
            const r = byId.get(c.id)
            const on = c.id === selected
            const stopped = c.mode !== 'road' && r?.level === 2
            return (
              <li key={c.id}>
                <button type="button" className={`route${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onSelect(c.id)}>
                  <span className="bar" style={{ background: MODE_COLOR[c.mode] }} aria-hidden="true" />
                  <span className="route-main">
                    <span className="n">{title(c, r)}</span>
                    <small>{subtitle(c, r, hour)}</small>
                    {on && profiles[c.id] && <Sparkline values={profiles[c.id]!} at={hour / 24} color={MODE_COLOR[c.mode]} />}
                  </span>
                  <span className="v mono">
                    {stopped ? (
                      <span className="off">Off</span>
                    ) : (
                      <>
                        {formatSpeed(r?.speed ?? 0)}
                        <small className={r?.level === 2 && c.mode === 'road' ? 'bad' : undefined}>{formatMinutes(r?.minutes ?? 0)}</small>
                      </>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {hidden > 0 && visible.length > 0 && (
        <p className="routes-foot">
          {hidden} hidden by layer filters ·{' '}
          <button type="button" className="link" onClick={onShowAll}>
            show all
          </button>
        </p>
      )}
    </section>
  )
}
