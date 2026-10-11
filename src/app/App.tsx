import { useEffect, useMemo, useReducer, useState } from 'react'
import { CORRIDORS } from '../model/corridors'
import { read } from '../model/traffic'
import { loadMapData } from '../data/load'
import type { MapData } from '../data/schema'
import { MapView, type MapStatus } from '../map/MapView'
import { initialState, reducer } from './state'

export function App() {
  const [state, dispatch] = useReducer(reducer, false, initialState)
  const [data, setData] = useState<MapData | null>(null)
  const [, setStatus] = useState<MapStatus>({ kind: 'loading' })
  useEffect(() => {
    loadMapData(CORRIDORS.map((c) => c.id)).then(setData)
  }, [])
  const readings = useMemo(
    () => (data ? CORRIDORS.map((c) => read(c, data.corridors[c.id]!.length, state.hour, state.scenario)) : []),
    [data, state.hour, state.scenario],
  )
  if (!data) return null
  return (
    <MapView
      data={data}
      corridors={CORRIDORS}
      readings={readings}
      layers={state.layers}
      selected={state.selected}
      onSelect={(id) => dispatch({ type: 'select', id })}
      motion={state.motion}
      inset={{ top: 0, right: 0, bottom: 0, left: 0 }}
      onStatus={setStatus}
      particles={Number(new URLSearchParams(location.search).get('particles')) || undefined}
      forceWebGL={new URLSearchParams(location.search).get('renderer') === 'webgl'}
      summary=""
    />
  )
}
