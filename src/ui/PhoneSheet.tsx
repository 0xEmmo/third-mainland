import { useRef, type ReactNode, type PointerEvent } from 'react'
import { Icon } from './Icon'

export type SheetTab = 'corridors' | 'details' | 'layers'

interface Props {
  tab: SheetTab
  open: boolean
  hasDetails: boolean
  onTab: (t: SheetTab) => void
  onOpen: (open: boolean) => void
  timebar: ReactNode
  children: Record<SheetTab, ReactNode>
}

const TABS: { id: SheetTab; label: string }[] = [
  { id: 'corridors', label: 'Corridors' },
  { id: 'details', label: 'Details' },
  { id: 'layers', label: 'Layers' },
]

/** Bottom sheet for phones: tabs on top, content that slides up, the time bar always docked below. */
export function PhoneSheet({ tab, open, hasDetails, onTab, onOpen, timebar, children }: Props) {
  const drag = useRef<{ y: number; moved: boolean } | null>(null)

  const onDown = (e: PointerEvent) => {
    drag.current = { y: e.clientY, moved: false }
  }
  const onMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) > 24 && !d.moved) {
      d.moved = true
      onOpen(dy < 0)
    }
  }
  const onUp = () => {
    drag.current = null
  }

  const pick = (t: SheetTab) => {
    onTab(t)
    onOpen(true)
  }

  return (
    <div className={`sheet${open ? ' open' : ''}`}>
      <div className="sheet-card panel">
        <div className="sheet-handle" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="sheet-tabs" role="tablist" aria-label="Panels">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-controls="sheet-panel"
                aria-selected={tab === t.id}
                className={t.id === 'details' && hasDetails ? 'has-dot' : undefined}
                onClick={() => pick(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="sheet-toggle"
            aria-expanded={open}
            aria-controls="sheet-panel"
            aria-label={open ? 'Collapse panel' : 'Expand panel'}
            onClick={() => onOpen(!open)}
          >
            <Icon name="chevron" size={18} />
          </button>
        </div>
        <div id="sheet-panel" className="sheet-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} hidden={!open}>
          {children[tab]}
        </div>
      </div>
      {timebar}
    </div>
  )
}
