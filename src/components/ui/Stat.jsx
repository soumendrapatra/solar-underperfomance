import { useCountUp } from '../../hooks/useCountUp.js'
import { useReducedMotion } from '../../hooks/useReducedMotion.js'
import { cn } from '../../lib/cn.js'

/**
 * CSS-only arrow made from borders — no icon library, no emoji.
 * direction: 'up' | 'down' | 'neutral'
 */
function Arrow({ direction }) {
  if (direction === 'neutral') return <span className="inline-block w-2 h-[1px] bg-current" />

  const isUp = direction === 'up'
  return (
    <span
      className="inline-block"
      style={{
        width: 0,
        height: 0,
        borderLeft: '4px solid transparent',
        borderRight: '4px solid transparent',
        ...(isUp
          ? { borderBottom: '5px solid currentColor', marginBottom: '1px' }
          : { borderTop: '5px solid currentColor', marginTop: '1px' }),
      }}
    />
  )
}

/**
 * @param {{
 *   label: string
 *   value: number
 *   unit?: string
 *   format?: (n: number) => string   - Custom formatter, overrides default
 *   decimals?: number
 *   delta?: number                   - Fractional delta, e.g. -0.12 → "-12.0 %"
 *   deltaLabel?: string              - Replaces default "% vs baseline"
 *   deltaPositiveIsGood?: boolean    - Controls arrow color direction
 *   className?: string
 * }} props
 */
export function Stat({
  label,
  value,
  unit,
  format,
  decimals = 1,
  delta,
  deltaLabel = '% vs baseline',
  deltaPositiveIsGood = true,
  className,
}) {
  const reduced = useReducedMotion()
  const animated = useCountUp(value, reduced ? 0 : 700)
  const displayed = format ? format(animated) : animated.toFixed(decimals)

  const deltaDirection =
    delta == null ? null : delta > 0.001 ? 'up' : delta < -0.001 ? 'down' : 'neutral'

  const deltaColor =
    delta == null
      ? ''
      : deltaPositiveIsGood
      ? delta >= 0
        ? 'text-ok'
        : 'text-fault'
      : delta <= 0
      ? 'text-ok'
      : 'text-fault'

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="label text-ink-2">{label}</span>

      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-medium text-ink tabular-nums leading-none">
          {displayed}
        </span>
        {unit && (
          <span className="font-mono text-xs text-ink-2 leading-none">{unit}</span>
        )}
      </div>

      {delta != null && (
        <div className={cn('flex items-center gap-1 font-mono text-[11px]', deltaColor)}>
          <Arrow direction={deltaDirection} />
          <span>
            {delta >= 0 ? '+' : ''}
            {(delta * 100).toFixed(1)}&nbsp;%&nbsp;
            <span className="text-ink-2">{deltaLabel}</span>
          </span>
        </div>
      )}
    </div>
  )
}
