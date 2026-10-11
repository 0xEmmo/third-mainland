import type { MapStatus } from '../map/MapView'
import { Icon, Mark } from './Icon'

interface Props {
  status: MapStatus
  online: boolean
  table: boolean
  compact: boolean
  onTable: (on: boolean) => void
  onAbout: () => void
}

export function TitleCard({ status, online, table, compact, onTable, onAbout }: Props) {
  const particles = status.kind === 'ready' ? status.particles.toLocaleString('en-NG') : '40,000'
  return (
    <header className={`title panel${compact ? ' compact' : ''}`}>
      <div className="title-row">
        <h1>
          <Mark />
          Third Mainland
        </h1>
        <div className="title-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={() => onTable(!table)}
            aria-pressed={table}
            aria-label={table ? 'Show the map' : 'Show as a table'}
            title={table ? 'Map' : 'Table'}
          >
            <Icon name={table ? 'map' : 'table'} size={17} />
          </button>
          {compact && (
            <button type="button" className="icon-btn" onClick={onAbout} aria-label="About this map">
              <Icon name="info" size={17} />
            </button>
          )}
        </div>
      </div>
      {!compact && (
        <p className="title-desc">
          How Lagos moves through a weekday, drawn from timetables and modelled road counts. Rendered on the GPU, {particles} particles.
        </p>
      )}
      <div className="title-tags">
        <button type="button" className="ill mono" onClick={onAbout}>
          <Icon name="info" size={12} />
          Illustrative, not live traffic
        </button>
        {status.kind === 'ready' && <span className="tag-mini mono">{status.backend}</span>}
        {!online && (
          <span className="tag-mini mono offline" role="status">
            <Icon name="offline" size={12} /> Offline · saved copy
          </span>
        )}
      </div>
    </header>
  )
}
