import { useId } from 'react'

interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  legend: string
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
  variant: 'chips' | 'segments'
  hideLegend?: boolean
}

/** Real radio inputs dressed as chips or a segmented control, so arrow keys and screen readers just work. */
export function Radios<T extends string>({ legend, value, options, onChange, variant, hideLegend = true }: Props<T>) {
  const name = useId()
  return (
    <fieldset className={`radios ${variant}`}>
      <legend className={hideLegend ? 'sr-only' : undefined}>{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={variant === 'chips' ? 'chip' : 'segment'}>
          <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}
