import { useEffect, useMemo, useReducer, useState } from 'react'
import { CORRIDORS } from '../model/corridors'
import { dayProfile, read, speedProfile } from '../model/traffic'
import { summarise } from '../model/describe'
import type { Mode } from '../model/types'
import { loadMapData, MapDataError } from '../data/load'
import type { MapData } from '../data/schema'
import { MapView, type MapStatus } from '../map/MapView'
import { TimeBar } from '../ui/TimeBar'
import { TitleCard } from '../ui/TitleCard'
import { Layers } from '../ui/Layers'
import { CorridorList } from '../ui/CorridorList'
import { Details } from '../ui/Details'
import { TableView } from '../ui/TableView'
import { About } from '../ui/About'
import { Notice } from '../ui/Notice'
import { PhoneSheet, type SheetTab } from '../ui/PhoneSheet'
import { UpdatePrompt } from './UpdatePrompt'
import { useIsPhone, useMediaQuery, useOnline, useReducedMotion } from './hooks'
import { initialState, reducer, restore, save } from './state'
import { useClock } from './useClock'
import './layout.css'

const IDS = new Set(CORRIDORS.map((c) => c.id))
const params = new URLSearchParams(location.search)
const FORCE_WEBGL = params.get('renderer') === 'webgl'
const PARTICLES = Number(params.get('particles')) || undefined

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: MapData }

export function App() {
  const reduced = useReducedMotion()
  const phone = useIsPhone()
  const online = useOnline()
  // Below this the floating details card would collide with the legend, so it moves into the side panel.
  const roomy = useMediaQuery('(min-width: 1180px) and (min-height: 820px)')
  const [state, dispatch] = useReducer(reducer, reduced, (r) => restore(initialState(r), IDS))
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [mapStatus, setMapStatus] = useState<MapStatus>({ kind: 'loading' })
  const [about, setAbout] = useState(false)
  const [tab, setTab] = useState<SheetTab>('corridors')
  const [sheetOpen, setSheetOpen] = useState(false)

  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    loadMapData(CORRIDORS.map((c) => c.id))
      .then((data) => live && setLoad({ kind: 'ready', data }))
      .catch((e: unknown) => live && setLoad({ kind: 'error', message: e instanceof MapDataError ? e.message : 'Something went wrong loading the map.' }))
    return () => {
      live = false
    }
  }, [attempt])
  const fetchData = () => {
    setLoad({ kind: 'loading' })
    setAttempt((n) => n + 1)
  }

  // A change to the OS setting mid-session is respected straight away.
  useEffect(() => {
    if (reduced) dispatch({ type: 'motion', on: false })
  }, [reduced])

  useEffect(() => {
    const t = setTimeout(() => save(state), 400)
    return () => clearTimeout(t)
  }, [state])

  // If the map can't be drawn, the table is the map.
  const mapFailed = mapStatus.kind === 'error'
  const showTable = state.table || mapFailed

  useClock(state.playing, state.rate, state.hour, (hour) => dispatch({ type: 'setHour', hour }))

  const data = load.kind === 'ready' ? load.data : null
  const lengths = useMemo(() => Object.fromEntries(CORRIDORS.map((c) => [c.id, data?.corridors[c.id]?.length ?? 1])), [data])
  const readings = useMemo(() => CORRIDORS.map((c) => read(c, lengths[c.id]!, state.hour, state.scenario)), [lengths, state.hour, state.scenario])
  const profile = useMemo(() => dayProfile(CORRIDORS, state.scenario), [state.scenario])
  const profiles = useMemo(() => Object.fromEntries(CORRIDORS.map((c) => [c.id, speedProfile(c, lengths[c.id]!, state.scenario)])), [lengths, state.scenario])
  const summary = useMemo(() => summarise(CORRIDORS, readings, state.hour, state.scenario), [readings, state.hour, state.scenario])

  const selected = CORRIDORS.find((c) => c.id === state.selected) ?? null
  const select = (id: string | null) => {
    dispatch({ type: 'select', id })
    if (phone && id) {
      setTab('details')
      setSheetOpen(true)
    }
  }
  const setLayer = (mode: Mode, on: boolean) => dispatch({ type: 'layer', mode, on })
  const showAll = () => (['road', 'brt', 'ferry', 'rail'] as Mode[]).forEach((m) => setLayer(m, true))

  const inset = phone ? { top: 100, right: 0, bottom: 300, left: 0 } : { top: 20, right: roomy ? 390 : 340, bottom: 210, left: roomy ? 370 : 320 }

  const list = (
    <CorridorList
      corridors={CORRIDORS}
      readings={readings}
      profiles={profiles}
      hour={state.hour}
      layers={state.layers}
      selected={state.selected}
      sort={state.sort}
      onSort={(sort) => dispatch({ type: 'sort', sort })}
      onSelect={(id) => select(id === state.selected && !phone ? null : id)}
      onShowAll={showAll}
    />
  )
  const details = selected && data && (
    <Details
      corridor={selected}
      reading={readings.find((r) => r.id === selected.id)}
      line={data.corridors[selected.id]?.line ?? []}
      length={lengths[selected.id]!}
      onClose={() => select(null)}
    />
  )
  const layers = <Layers layers={state.layers} motion={state.motion} onLayer={setLayer} onMotion={(on) => dispatch({ type: 'motion', on })} />
  const timebar = (
    <TimeBar
      hour={state.hour}
      playing={state.playing}
      scenario={state.scenario}
      rate={state.rate}
      profile={profile}
      motion={state.motion}
      compact={phone}
      onHour={(hour) => dispatch({ type: 'setHour', hour })}
      onNudge={(minutes) => dispatch({ type: 'nudge', minutes })}
      onPlay={(playing) => dispatch({ type: 'play', playing })}
      onScenario={(scenario) => dispatch({ type: 'scenario', scenario })}
      onRate={(rate) => dispatch({ type: 'rate', rate })}
    />
  )

  const title = (
    <TitleCard
      status={mapStatus}
      online={online}
      table={showTable}
      compact={phone}
      onTable={(on) => dispatch({ type: 'table', on })}
      onAbout={() => setAbout(true)}
    />
  )

  return (
    <div className={`app${phone ? ' is-phone' : ' is-wide'}${showTable ? ' has-table' : ''}`}>
      <a className="skip" href="#controls">
        Skip to the controls
      </a>
      <main className="stage" aria-label="Lagos movement">
        {data && (
          <div className="map-layer" hidden={showTable && phone} aria-hidden={showTable ? true : undefined}>
            <MapView
              data={data}
              corridors={CORRIDORS}
              readings={readings}
              layers={state.layers}
              selected={state.selected}
              onSelect={select}
              motion={state.motion}
              inset={inset}
              forceWebGL={FORCE_WEBGL}
              particles={PARTICLES}
              onStatus={setMapStatus}
              summary={summary}
            />
          </div>
        )}
        {showTable && data && (
          <TableView
            corridors={CORRIDORS}
            readings={readings}
            hour={state.hour}
            scenario={state.scenario}
            selected={state.selected}
            onSelect={(id) => dispatch({ type: 'select', id })}
          />
        )}
        <div className="notices">
          {load.kind === 'loading' && <Notice tone="loading" title="Loading the map of Lagos…" />}
          {load.kind === 'error' && <Notice tone="error" title="The map didn’t load" body={load.message} action={{ label: 'Try again', onClick: fetchData }} />}
          {data && mapStatus.kind === 'loading' && !showTable && <Notice tone="loading" title="Starting the GPU…" />}
          {mapFailed && <Notice tone="error" title="The map can’t be drawn here" body={`${mapStatus.message} The table below has every figure.`} />}
        </div>
      </main>

      {phone ? title : null}

      <div id="controls" className="controls" tabIndex={-1}>
        {phone ? (
          <PhoneSheet tab={tab} open={sheetOpen} onTab={setTab} onOpen={setSheetOpen} hasDetails={!!details} timebar={timebar}>
            {{ corridors: list, details: details ?? <p className="sheet-empty">Tap a line on the map or pick a corridor to see its details.</p>, layers }}
          </PhoneSheet>
        ) : (
          <>
            <div className="left-col">
              {title}
              {layers}
            </div>
            <aside className="side panel">
              {!roomy && details && <div className="side-details">{details}</div>}
              {list}
            </aside>
            {roomy && details && <div className="inset panel">{details}</div>}
            <div className={`time-wrap${roomy && details ? ' beside-inset' : ''}`}>{timebar}</div>
          </>
        )}
      </div>

      <About open={about} onClose={() => setAbout(false)} generated={data?.generated ?? ''} />
      <UpdatePrompt />
      <p className="sr-only" aria-live="polite">
        {selected ? `${selected.name} selected.` : ''}
      </p>
    </div>
  )
}
