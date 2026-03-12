interface Props {
  value: number
  max?: number
  size?: 'sm' | 'md'
  color?: string
}

export default function ProgressBar({ value, max = 100, size = 'sm', color }: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const barColor = color ?? (pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-slate-300')
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5'

  return (
    <div className={`w-full ${h} bg-slate-200 rounded-full overflow-hidden`}>
      <div
        className={`${h} ${barColor} rounded-full transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
