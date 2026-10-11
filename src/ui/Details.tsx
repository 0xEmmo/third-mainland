import type { Corridor, Reading } from '../model/types'
import { formatClock, formatMinutes, formatSpeed } from '../model/time'
import { PHOTOS } from '../model/photos'
import { MODE_NAME, status, vehicle } from '../model/describe'
import { MODE_COLOR } from '../map/flows'
import type { Point } from '../geo/project'
import { Icon } from './Icon'

interface Props {
  corridor: Corridor
  reading: Reading | undefined
  line: readonly Point[]
  length: number
  onClose: () => void
}

/** The route itself, drawn small, for corridors without a photo. */
function Sketch({ line, color }: { line: readonly Point[]; color: string }) {
  if (line.length < 2) return null
  const xs = line.map((p) => p[0])
  const ys = line.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const W = 260
  const H = 110
  const s = Math.min((W - 40) / (maxX - minX || 1), (H - 30) / (maxY - minY || 1))
  const ox = (W - (maxX - minX) * s) / 2
  const oy = (H - (maxY - minY) * s) / 2
  const pts = line.map(([x, y]) => `${(ox + (x - minX) * s).toFixed(1)},${(H - oy - (y - minY) * s).toFixed(1)}`)
  const [sx, sy] = pts[0]!.split(',')
  const [ex, ey] = pts[pts.length - 1]!.split(',')
  return (
    <svg className="sketch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Outline of the route">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="6" opacity="0.18" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx} cy={sy} r="4" fill="var(--bg)" stroke={color} strokeWidth="2" />
      <circle cx={ex} cy={ey} r="4" fill={color} />
    </svg>
  )
}

export function Details({ corridor: c, reading: r, line, length, onClose }: Props) {
  const photo = PHOTOS[c.id]
  const st = status(c, r)
  return (
    <section className="details" aria-labelledby="details-h">
      <div className="details-media">
        {photo ? <img src={photo.src} alt={photo.alt} width={1280} height={853} decoding="async" /> : <Sketch line={line} color={MODE_COLOR[c.mode]} />}
        <button type="button" className="details-close" onClick={onClose} aria-label="Close details">
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="bd">
        <p className="k">
          {MODE_NAME[c.mode]} · {length.toFixed(1)} km
        </p>
        <h2 id="details-h">{c.name}</h2>
        <p className="ends">
          {c.from} to {c.to}
        </p>
        {r && c.mode === 'road' && r.directions ? (
          <>
            <p className="big mono">
              {r.volume.toLocaleString('en-NG')}
              <span> / 10 min</span>
            </p>
            <table className="dirs">
              <caption className="sr-only">Both directions</caption>
              <thead>
                <tr>
                  <th scope="col">Direction</th>
                  <th scope="col">Speed</th>
                  <th scope="col">End to end</th>
                </tr>
              </thead>
              <tbody>
                {r.directions.map((d, i) => (
                  <tr key={i} className={i === r.slowDirection ? 'slow' : undefined}>
                    <th scope="row">{c.directions[i]}</th>
                    <td className="mono">{formatSpeed(d.speed)}</td>
                    <td className="mono">{formatMinutes(d.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : r && c.mode !== 'road' ? (
          <>
            <p className="big mono">
              {r.headway == null ? 'Off' : r.volume}
              <span>{r.headway == null ? ' · not running' : ` ${vehicle(c)}${r.volume === 1 ? '' : c.mode === 'brt' ? 'es' : 's'} out`}</span>
            </p>
            <dl className="facts">
              <div>
                <dt>Every</dt>
                <dd className="mono">{r.headway == null ? '—' : `${r.headway} min`}</dd>
              </div>
              <div>
                <dt>Next</dt>
                <dd className="mono">{r.next == null ? 'Tomorrow' : formatClock(r.next)}</dd>
              </div>
              <div>
                <dt>End to end</dt>
                <dd className="mono">{formatMinutes(r.minutes)}</dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd className="mono">
                  {formatClock(c.hours[0])}–{formatClock(c.hours[1])}
                </dd>
              </div>
            </dl>
          </>
        ) : null}
        <p className={`tag ${st.tone}`}>{st.label}</p>
        {c.note && <p className="note">{c.note}</p>}
        {photo && (
          <p className="credit">
            <a href={photo.source} target="_blank" rel="noreferrer">
              {photo.credit}
            </a>
          </p>
        )}
      </div>
    </section>
  )
}
