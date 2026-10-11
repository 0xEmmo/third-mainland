/**
 * Pulls the handful of Lagos features the map needs from OpenStreetMap via
 * Overpass and stores the raw responses in data/raw. Run `npm run data:build`
 * afterwards to turn them into the small file the app ships.
 *
 * The raw files are git-ignored: they are large and can be fetched again.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'

const ENDPOINTS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : ['https://lambert.openstreetmap.de/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const BBOX = '6.38,3.20,6.67,3.64' // south, west, north, east
const OUT = new URL('../data/raw/', import.meta.url)

const corridorNames = [
  'Third Mainland Bridge',
  'Ikorodu Road',
  'Apapa-Oshodi Expressway',
  'Oshodi-Apapa Expressway',
  'Lekki-Epe Expressway',
  'Lagos-Ibadan Expressway',
  'Eko Bridge',
  'Carter Bridge',
  'Agege Motor Road',
  'Ozumba Mbadiwe Avenue',
  'Lagos-Badagry Expressway',
  'Funsho Williams Avenue',
  'Herbert Macaulay Way',
  'Awolowo Road',
  'Obafemi Awolowo Way',
  'Ikorodu-Shagamu Road',
]

const queries: Record<string, string> = {
  corridors: `way[highway][name~"^(${corridorNames.join('|')})$",i](${BBOX});out geom;`,
  streets: `way[highway~"^(motorway|trunk|primary|secondary|motorway_link|trunk_link)$"](${BBOX});out geom;`,
  rail: `way[railway~"^(light_rail|rail|subway|construction)$"](${BBOX});out geom;`,
  railRoutes: `relation[route~"^(light_rail|train|subway)$"](${BBOX});out tags;`,
  ferry: `way[route=ferry](${BBOX});out geom;`,
  brt: `(relation[route=bus][name~"BRT",i](${BBOX});way[highway=busway](${BBOX});way[busway~"lane|track"](${BBOX}););out geom(${BBOX});`,
  coast: `way[natural=coastline](${BBOX});out geom;`,
  water: `(relation[natural=water][name~"lagoon|harbour|creek",i](${BBOX});way[natural=water][name~"lagoon|creek",i](${BBOX}););out geom;`,
  // The harbour and channels round Lagos Island are separate, mostly unnamed, water areas.
  harbour: `(way[natural=water](6.405,3.33,6.48,3.45);relation[natural=water](6.405,3.33,6.48,3.45);way[natural=bay](6.405,3.33,6.48,3.45););out geom;`,
  places: `node[place~"^(city|town|suburb|neighbourhood|quarter|island)$"](${BBOX});out;`,
  stops: `(node[amenity=ferry_terminal](${BBOX});node[railway=station](${BBOX});node[public_transport=station](${BBOX}););out;`,
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function run(name: string, body: string) {
  const file = new URL(`${name}.json`, OUT)
  if (existsSync(file) && !process.argv.includes('--force')) {
    console.log(`skip ${name} (cached)`)
    return
  }
  const query = `[out:json][timeout:120];${body}`
  for (let attempt = 1; attempt <= 10; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length]!
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'third-mainland-data/0.1 (github.com/0xEmmo)' },
      body: new URLSearchParams({ data: query }),
    })
    if (res.ok) {
      const text = await res.text()
      writeFileSync(file, text)
      console.log(`${name}: ${(text.length / 1024).toFixed(0)} KB`)
      return
    }
    console.warn(`${name}: HTTP ${res.status} from ${new URL(endpoint).host}, retrying`)
    await sleep(Math.min(attempt, 4) * 6000)
  }
  throw new Error(`Overpass kept failing for ${name}`)
}

mkdirSync(OUT, { recursive: true })
for (const [name, body] of Object.entries(queries)) {
  await run(name, body)
  await sleep(1500)
}
