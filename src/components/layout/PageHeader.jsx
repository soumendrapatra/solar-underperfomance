import { cn } from '../../lib/cn.js'

/**
 * Editorial PageHeader.
 * @param {{
 *   eyebrow?: string
 *   title: string
 *   description?: string
 *   children?: React.ReactNode
 *   className?: string
 * }} props
 */
export function PageHeader({ eyebrow, title, description, children, className }) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-line dark:border-console-line',
        className
      )}
    >
      <div className="flex flex-col gap-1">
        {eyebrow && <span className="label text-accent">{eyebrow}</span>}
        <h1 className="font-display text-2xl sm:text-3xl font-normal text-ink dark:text-console-text tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="font-sans text-sm text-ink-2 dark:text-console-text/70 mt-0.5 max-w-2xl">
            {description}
          </p>
        )}
      </div>

      {children && <div className="flex items-center gap-3 shrink-0">{children}</div>}
    </div>
  )
}

export default PageHeader
