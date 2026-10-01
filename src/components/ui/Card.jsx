import { cn } from '../../lib/cn.js'

/**
 * @param {{
 *   header?: React.ReactNode      - Left-side header content
 *   headerRight?: React.ReactNode - Right-side header slot
 *   figure?: string               - e.g. "03" renders "Fig. 03" in corner
 *   className?: string
 *   bodyClass?: string
 *   children: React.ReactNode
 *   noPadding?: boolean
 * }} props
 */
export function Card({ header, headerRight, figure, className, bodyClass, children, noPadding = false }) {
  return (
    <div className={cn('relative border border-line bg-paper', className)}>
      {/* Figure label — top-right corner */}
      {figure && (
        <span className="absolute top-2 right-3 font-mono text-[10px] text-line tracking-[0.06em] select-none pointer-events-none">
          Fig.&nbsp;{figure.toString().padStart(2, '0')}
        </span>
      )}

      {/* Header row */}
      {(header || headerRight) && (
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 gap-4">
          {header && (
            <span className="label text-ink-2 truncate">{header}</span>
          )}
          {headerRight && (
            <div className="shrink-0">{headerRight}</div>
          )}
        </div>
      )}

      {/* Body */}
      <div className={cn(!noPadding && 'px-4 py-4', bodyClass)}>
        {children}
      </div>
    </div>
  )
}
