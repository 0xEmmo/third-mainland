import type { Mode } from '../model/types'
import { MODE_NAME } from '../model/describe'
import { MODE_COLOR } from '../map/flows'

interface Props {
  layers: Record<Mode, boolean>
  motion: boolean
  onLayer: (mode: Mode, on: boolean) => void
  onMotion: (on: boolean) => void
}

const ORDER: Mode[] = ['road', 'brt', 'ferry', 'rail']

/** The legend doubles as the layer switches. */
export function Layers({ layers, motion, onLayer, onMotion }: Props) {
  return (
    <section className="leg panel" aria-label="Layers">
      <div className="leg-grid" role="group" aria-label="Show on the map">
        {ORDER.map((m) => (
          <button key={m} type="button" className="leg-item" aria-pressed={layers[m]} onClick={() => onLayer(m, !layers[m])}>
            <i style={{ background: MODE_COLOR[m], boxShadow: layers[m] ? `0 0 8px ${MODE_COLOR[m]}` : 'none' }} aria-hidden="true" />
            {m === 'rail' ? 'Rail' : MODE_NAME[m]}
          </button>
        ))}
      </div>
      <label className="switch">
        <input type="checkbox" role="switch" checked={motion} onChange={(e) => onMotion(e.target.checked)} />
        <span className="switch-track" aria-hidden="true" />
        Animate flows
      </label>
    </section>
  )
}
