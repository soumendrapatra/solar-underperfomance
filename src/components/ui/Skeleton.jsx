import { cn } from '../../lib/cn.js'

/**
 * Skeleton shimmer block. The shimmer moves at 1.6 s, low-contrast.
 * @param {{ className?: string; height?: string }} props
 */
export function Skeleton({ className, height }) {
  return (
    <div
      className={cn('skeleton-shimmer bg-line/60 overflow-hidden', className)}
      style={height ? { height } : undefined}
      aria-hidden="true"
    />
  )
}
