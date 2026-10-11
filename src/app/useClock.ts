import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Rate } from './state'

/**
 * Runs the map clock while playing. The clock ticks every frame internally but
 * only reports whole minutes, so React re-renders once a map-minute rather
 * than sixty times a second.
 */
export function useClock(playing: boolean, rate: Rate, hour: number, onMinute: (hour: number) => void) {
  const hourRef = useRef(hour)
  const cb = useRef(onMinute)
  useLayoutEffect(() => {
    cb.current = onMinute
  })

  // External changes (slider, presets) win over the running clock.
  useEffect(() => {
    if (Math.abs(hourRef.current - hour) > 1 / 60) hourRef.current = hour
  }, [hour])

  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let raf = 0
    let lastMinute = Math.floor(hourRef.current * 60)
    const tick = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000)
      last = now
      hourRef.current = (hourRef.current + (dt * rate) / 60) % 24
      const minute = Math.floor(hourRef.current * 60)
      if (minute !== lastMinute) {
        lastMinute = minute
        cb.current(minute / 60)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, rate])
}
