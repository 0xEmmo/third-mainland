import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

interface Props {
  open: boolean
  onClose: () => void
  generated: string
}

export function About({ open, onClose, generated }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="about" aria-labelledby="about-h" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="about-inner">
        <div className="about-head">
          <h2 id="about-h">About this map</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <p>
          <strong>The lines are real; the traffic is a model.</strong> Every road, rail line, ferry route and shoreline was traced from OpenStreetMap. The flows
          on them come from a hand-tuned model of a Lagos weekday, not from live sensors.
        </p>
        <h3>How the model works</h3>
        <ul>
          <li>
            Each road has a capacity and two rush hours. Demand above capacity slows it down using the BPR curve that transport planners use, tuned so a full
            Third Mainland Bridge crawls.
          </li>
          <li>BRT and trains run on headways; buses lose a little speed at junctions in the peak even in their own lane.</li>
          <li>Ferries follow a timetable and stop at dusk, because Lagos waterways close to commercial boats after dark.</li>
          <li>Saturday moves the peak to midday markets. A rain day cuts road capacity by about a fifth and thins the ferry timetable.</li>
        </ul>
        <h3>Using it</h3>
        <ul>
          <li>Drag or use the arrow keys to pan; pinch, scroll or press + and − to zoom; tap a line to select it.</li>
          <li>The table view lists every figure the map shows.</li>
          <li>It works offline once loaded, and can be installed as an app.</li>
        </ul>
        <p className="about-foot">
          Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, ODbL, extracted {generated}. Photos from Wikimedia
          Commons, CC BY-SA 4.0. Built by Emmanuel Balogun.
        </p>
      </div>
    </dialog>
  )
}
