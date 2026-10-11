interface Props {
  values: readonly number[]
  /** 0..1 position of the marker along the line. */
  at: number
  width?: number
  height?: number
  color: string
}

/** Speed through the day, upside down so the rush hours read as peaks of trouble. */
export function Sparkline({ values, at, width = 150, height = 18, color }: Props) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, 2 + ((v - min) / span) * (height - 4)] as const)
  const i = Math.min(values.length - 1, Math.max(0, Math.round(at * (values.length - 1))))
  const [mx, my] = pts[i]!
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={`M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}`} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={mx} cy={my} r="2.5" fill="var(--road-soft)" />
    </svg>
  )
}
