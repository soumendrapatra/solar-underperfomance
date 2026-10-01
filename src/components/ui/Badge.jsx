import { cn } from '../../lib/cn.js'

const VARIANT = {
  critical: 'border-l-fault   bg-fault/10   text-fault',
  high:     'border-l-fault   bg-fault/[.08] text-fault',
  medium:   'border-l-warn    bg-warn/10    text-warn',
  low:      'border-l-ok      bg-ok/10      text-ok',
  info:     'border-l-info    bg-info/10    text-info',
  ok:       'border-l-ok      bg-ok/10      text-ok',
}

/**
 * @param {{
 *   variant?: 'critical'|'high'|'medium'|'low'|'info'|'ok'
 *   children: React.ReactNode
 *   className?: string
 * }} props
 */
export function Badge({ variant = 'info', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border-l-2 px-2 py-0.5',
        'font-mono text-[10px] uppercase tracking-[0.08em] leading-none',
        VARIANT[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
