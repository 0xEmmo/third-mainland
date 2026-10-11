import { Icon } from './Icon'

interface Props {
  tone: 'loading' | 'error'
  title: string
  body?: string
  action?: { label: string; onClick: () => void }
}

export function Notice({ tone, title, body, action }: Props) {
  return (
    <div className={`notice panel ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {tone === 'loading' && <span className="spinner" aria-hidden="true" />}
      <div>
        <p className="notice-title">{title}</p>
        {body && <p className="notice-body">{body}</p>}
      </div>
      {action && (
        <button type="button" className="chip" onClick={action.onClick}>
          <Icon name="retry" size={13} /> {action.label}
        </button>
      )}
    </div>
  )
}
