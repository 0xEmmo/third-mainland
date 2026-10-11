import type { Corridor, Reading } from '../model/types'
import { MODE_NAME, status, subtitle } from '../model/describe'
import { formatClock, formatMinutes, formatSpeed, dayName, period } from '../model/time'
import type { Scenario } from '../model/types'

interface Props {
  corridors: readonly Corridor[]
  readings: readonly Reading[]
  hour: number
  scenario: Scenario
  selected: string | null
  onSelect: (id: string) => void
}

/** Every number the map shows, as a plain table. The accessible way in, and handy for anyone who just wants the figures. */
export function TableView({ corridors, readings, hour, scenario, selected, onSelect }: Props) {
  const byId = new Map(readings.map((r) => [r.id, r]))
  return (
    <section className="table-view panel" aria-labelledby="table-h">
      <h2 id="table-h">
        Every corridor at <span className="mono">{formatClock(hour)}</span>
        <small>
          {dayName(scenario)}, {period(hour)}. Figures are modelled, not measured.
        </small>
      </h2>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Corridor figures">
        <table>
          <thead>
            <tr>
              <th scope="col">Corridor</th>
              <th scope="col">Mode</th>
              <th scope="col">Slower way</th>
              <th scope="col">Speed</th>
              <th scope="col">End to end</th>
              <th scope="col">Volume or service</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {corridors.map((c) => {
              const r = byId.get(c.id)
              const st = status(c, r)
              return (
                <tr key={c.id} className={c.id === selected ? 'on' : undefined}>
                  <th scope="row">
                    <button type="button" className="link" onClick={() => onSelect(c.id)} aria-pressed={c.id === selected}>
                      {c.name}
                    </button>
                    <small>
                      {c.from} to {c.to}
                    </small>
                  </th>
                  <td>{MODE_NAME[c.mode]}</td>
                  <td>{c.mode === 'road' && r?.slowDirection !== undefined ? c.directions[r.slowDirection] : '—'}</td>
                  <td className="mono">{r && st.tone !== 'off' ? formatSpeed(r.speed) : '—'}</td>
                  <td className="mono">{r && st.tone !== 'off' ? formatMinutes(r.minutes) : '—'}</td>
                  <td className="mono">{c.mode === 'road' ? `${(r?.volume ?? 0).toLocaleString('en-NG')} / 10 min` : subtitle(c, r, hour)}</td>
                  <td>
                    <span className={`tag ${st.tone}`}>{st.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
