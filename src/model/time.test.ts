import { formatClock, formatMinutes, parseClock, period, wrapHour } from './time'

describe('time helpers', () => {
  it('formats and wraps the clock', () => {
    expect(formatClock(7 + 40 / 60)).toBe('07:40')
    expect(formatClock(23.999)).toBe('00:00')
    expect(formatClock(-0.5)).toBe('23:30')
    expect(wrapHour(25)).toBe(1)
  })

  it('parses typed times and rejects nonsense', () => {
    expect(parseClock('07:40')).toBeCloseTo(7.6667, 3)
    expect(parseClock('7:05')).toBeCloseTo(7.0833, 3)
    expect(parseClock('1830')).toBe(18.5)
    expect(parseClock('24:00')).toBeNull()
    expect(parseClock('7:60')).toBeNull()
    expect(parseClock('soon')).toBeNull()
  })

  it('names the part of the day', () => {
    expect(period(7.6)).toBe('morning peak')
    expect(period(2)).toBe('small hours')
    expect(period(21)).toBe('late evening')
  })

  it('formats journey times', () => {
    expect(formatMinutes(47.6)).toBe('48 min')
    expect(formatMinutes(72)).toBe('1 h 12 min')
  })
})
