import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** A new build is waiting in the service worker; let the person choose when to reload. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 6000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="update panel" role="status">
      {needRefresh ? (
        <>
          <span>A newer version of the map is ready.</span>
          <button type="button" className="chip on" onClick={() => void updateServiceWorker(true)}>
            Reload
          </button>
          <button type="button" className="chip" onClick={() => setNeedRefresh(false)}>
            Later
          </button>
        </>
      ) : (
        <>
          <span>Saved for offline. The map will open without a connection.</span>
          <button type="button" className="chip" onClick={() => setOfflineReady(false)}>
            OK
          </button>
        </>
      )}
    </div>
  )
}
