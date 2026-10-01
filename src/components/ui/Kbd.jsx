import { cn } from '../../lib/cn.js'

/**
 * Keyboard hint chip — renders a key name in a mono bordered box.
 * @param {{ children: React.ReactNode; className?: string }} props
 */
export function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center',
        'font-mono text-[10px] tracking-[0.04em] text-ink-2',
        'border border-line bg-paper-2 px-1.5 py-0.5 leading-none',
        className
      )}
    >
      {children}
    </kbd>
  )
}
