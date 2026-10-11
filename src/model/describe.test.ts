import { CORRIDORS } from './corridors'
import { sortCorridors, status, subtitle, summarise, title } from './describe'
import { read } from './traffic'

const readingsAt = (h: number) => CORRIDORS.map((c) => read(c, 10, h, 'weekday'))
const byId = (id: string) => CORRIDORS.find((c) => c.id === id)!

describe('describing corridors', () => {
  it('names the slow direction of a road', () => {
    const r = readingsAt(7.67)
    const c = byId('third-mainland')
    expect(
      title(
        c,
        r.find((x) => x.id === c.id),
      ),
    ).toBe('Third Mainland Bridge, south')
  })

  it('writes transit subtitles from the timetable', () => {
    const r = readingsAt(7.67)
    const ferry = byId('ferry-ikorodu')
    expect(
      subtitle(
        ferry,
        r.find((x) => x.id === ferry.id),
        7.67,
      ),
    ).toBe('Next boat 07:55')
    const brt = byId('brt-ikorodu')
    expect(
      subtitle(
        brt,
        r.find((x) => x.id === brt.id),
        7.67,
      ),
    ).toBe('Bus every 3 min · own lane')
    const night = readingsAt(23)
    expect(
      subtitle(
        brt,
        night.find((x) => x.id === brt.id),
        23,
      ),
    ).toBe('Not running · resumes 05:30')
    const dawn = readingsAt(5)
    expect(
      subtitle(
        brt,
        dawn.find((x) => x.id === brt.id),
        5,
      ),
    ).toBe('First bus 05:30')
  })

  it('sorts slowest first, with stopped transit at the end', () => {
    const r = readingsAt(23)
    const sorted = sortCorridors(CORRIDORS, r, 'slowest')
    expect(sorted[sorted.length - 1]!.mode).not.toBe('road')
    expect(sortCorridors(CORRIDORS, r, 'az')[0]!.name).toBe('Agege Motor Road')
  })

  it('labels status and summarises the city', () => {
    const r = readingsAt(7.67)
    expect(
      status(
        byId('third-mainland'),
        r.find((x) => x.id === 'third-mainland'),
      ).tone,
    ).toBe('jam')
    const s = summarise(CORRIDORS, r, 7.67, 'weekday')
    expect(s).toMatch(/^07:40, Monday, morning peak\. Slowest road: /)
    expect(s).toMatch(/roads are jammed/)
  })
})
