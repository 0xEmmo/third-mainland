import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import type { Scenario } from '../model/types'
import { SCENARIO_LABEL } from '../model/traffic'
import { DAY, PRESETS, dayName, formatClock, period, wrapHour } from '../model/time'
import type { Rate } from '../app/state'
import { Icon } from './Icon'
import { Radios } from './Radios'
import './timebar.css'

interface Props {
  hour: number
  playing: boolean
  scenario: Scenario
  rate: Rate
  profile: readonly number[]
  motion: boolean
  compact: boolean
  onHour: (hour: number) => void
  onNudge: (minutes: number) => void
  onPlay: (playing: boolean) => void
  onScenario: (s: Scenario) => void
  onRate: (r: Rate) => void
}

const SCENARIO_OPTIONS = (Object.keys(SCENARIO_LABEL) as Scenario[]).map((value) => ({ value, label: SCENARIO_LABEL[value] }))

export function TimeBar(props: Props) {
  const { hour, playing, scenario, rate, profile, motion, compact, onHour, onNudge, onPlay, onScenario, onRate } = props
  const track = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const hourAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    // Snap to five minutes so dragging feels like a dial, not a float.
    return Math.min(DAY - 1 / 60, Math.round((f * DAY * 60) / 5) * (5 / 60))
  }

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onHour(hourAt(e.clientX))
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) onHour(hourAt(e.clientX))
  }
  const onUp = () => {
    dragging.current = false
  }

  const onKey = (e: KeyboardEvent) => {
    const big = e.shiftKey ? 30 : 5
    const map: Record<string, () => void> = {
      ArrowRight: () => onNudge(big),
      ArrowUp: () => onNudge(big),
      ArrowLeft: () => onNudge(-big),
      ArrowDown: () => onNudge(-big),
      PageUp: () => onNudge(60),
      PageDown: () => onNudge(-60),
      Home: () => onHour(0),
      End: () => onHour(DAY - 1 / 60),
    }
    const fn = map[e.key]
    if (!fn) return
    e.preventDefault()
    fn()
  }

  const minutes = Math.round(wrapHour(hour) * 60) % (DAY * 60)
  const ticks = compact ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24]
  const W = 100
  const bw = W / profile.length

  return (
    <section className={`timebar panel${compact ? ' compact' : ''}`} aria-label="Time of day">
      <div className="tb-top">
        <button
          type="button"
          className="icon-btn play"
          onClick={() => onPlay(!playing)}
          aria-pressed={playing}
          aria-label={playing ? 'Pause the clock' : 'Play the day forward'}
          title={motion ? undefined : 'Flows are still because motion is off, but the clock still runs'}
        >
          <Icon name={playing ? 'pause' : 'play'} size={16} />
        </button>
        <p className="clock mono">
          <time aria-live={playing ? 'off' : 'polite'}>{formatClock(hour)}</time>
          <small>
            {dayName(scenario)} · {period(hour)}
          </small>
        </p>
        <div className="tb-options">
          <Radios legend="Kind of day" value={scenario} options={SCENARIO_OPTIONS} onChange={onScenario} variant="chips" />
          <button
            type="button"
            className="chip rate"
            onClick={() => onRate(rate === 1 ? 10 : 1)}
            aria-label={`Playback speed: ${rate} map minute${rate > 1 ? 's' : ''} per second. Change speed`}
          >
            {rate} min = 1 s
          </button>
        </div>
      </div>

      <div
        ref={track}
        className="tb-track"
        role="slider"
        tabIndex={0}
        aria-label="Time of day"
        aria-valuemin={0}
        aria-valuemax={DAY * 60 - 1}
        aria-valuenow={minutes}
        aria-valuetext={`${formatClock(hour)}, ${period(hour)}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      >
        <svg viewBox={`0 0 ${W} 40`} preserveAspectRatio="none" aria-hidden="true">
          {profile.map((v, i) => {
            const h = Math.max(2.5, v * 36)
            const past = (i + 1) / profile.length <= hour / DAY
            return <rect key={i} x={i * bw + bw * 0.12} y={40 - h} width={bw * 0.76} height={h} rx={0.3} className={past ? 'past' : undefined} />
          })}
        </svg>
        <span className="tb-thumb" style={{ left: `${(wrapHour(hour) / DAY) * 100}%` }} aria-hidden="true" />
      </div>
      <div className="tb-ticks mono" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t}>{String(t).padStart(2, '0')}:00</span>
        ))}
      </div>

      <div className="tb-presets" role="group" aria-label="Jump to">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="preset"
            onClick={() => onHour(p.hour)}
            aria-label={`Jump to ${p.label.toLowerCase()}, ${formatClock(p.hour)}`}
          >
            {p.label} <span className="mono">{formatClock(p.hour)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
