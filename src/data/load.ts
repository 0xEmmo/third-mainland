import type { MapData } from './schema'

export class MapDataError extends Error {}

/** Fetches the map file and checks it has the corridors the app expects. */
export async function loadMapData(ids: readonly string[], fetcher: typeof fetch = fetch, url = '/data/lagos.json'): Promise<MapData> {
  let res: Response
  try {
    res = await fetcher(url)
  } catch {
    throw new MapDataError('The map data could not be downloaded. Check your connection and try again.')
  }
  if (!res.ok) throw new MapDataError(`The map data could not be loaded (HTTP ${res.status}).`)
  let data: MapData
  try {
    data = (await res.json()) as MapData
  } catch {
    throw new MapDataError('The map data arrived damaged.')
  }
  const missing = ids.filter((id) => !data.corridors?.[id]?.line?.length)
  if (missing.length) throw new MapDataError(`The map data is missing ${missing.join(', ')}.`)
  return data
}
