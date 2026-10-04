interface StepperProps {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
}

/** Plus/minus input so numbers can be set with one thumb, without the keyboard. */
export function Stepper({ label, value, onChange, step = 1, min = 0, max = 999 }: StepperProps) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)))
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-controls">
        <button type="button" aria-label={`${label} verringern`} onClick={() => set(value - step)} disabled={value <= min}>
          −
        </button>
        <output aria-live="polite">{value}</output>
        <button type="button" aria-label={`${label} erhöhen`} onClick={() => set(value + step)} disabled={value >= max}>
          +
        </button>
      </div>
    </div>
  )
}
