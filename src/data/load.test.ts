import { loadMapData, MapDataError } from './load'

const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch

describe('loadMapData', () => {
  it('returns data that has every corridor', async () => {
    const data = await loadMapData(['a'], ok({ corridors: { a: { line: [[0, 0]], length: 1 } } }))
    expect(data.corridors.a!.length).toBe(1)
  })

  it('explains each way it can fail', async () => {
    await expect(loadMapData(['a'], ok({ corridors: {} }))).rejects.toThrow('missing a')
    await expect(loadMapData(['a'], (async () => new Response('', { status: 404 })) as typeof fetch)).rejects.toThrow('HTTP 404')
    await expect(loadMapData(['a'], (async () => new Response('{bad', { status: 200 })) as typeof fetch)).rejects.toThrow('damaged')
    await expect(
      loadMapData(['a'], async () => {
        throw new TypeError('Failed to fetch')
      }),
    ).rejects.toBeInstanceOf(MapDataError)
  })
})
