import { motion } from 'framer-motion'
import { cn } from '../../lib/cn.js'

// Three-dot loading indicator — mono dots, not a spinner
function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block w-[3px] h-[3px] rounded-full bg-current"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

const BASE =
  'relative inline-flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] select-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40'

const SIZE = {
  sm: 'h-7 px-3',
  md: 'h-8 px-4',
}

const VARIANT = {
  primary:
    "bg-ink text-paper border border-ink overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-ink-2 before:translate-x-[-101%] hover:before:translate-x-0 before:transition-transform before:duration-200 before:ease-in-out",
  secondary:
    "bg-transparent text-ink border border-ink overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-ink before:translate-x-[-101%] hover:before:translate-x-0 hover:text-paper before:transition-transform before:duration-200 before:ease-in-out",
  ghost:
    'bg-transparent text-ink-2 border border-transparent hover:text-ink hover:border-line',
  danger:
    "bg-transparent text-fault border border-fault overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-fault before:translate-x-[-101%] hover:before:translate-x-0 hover:text-paper before:transition-transform before:duration-200 before:ease-in-out",
}

/**
 * @param {{
 *   variant?: 'primary'|'secondary'|'ghost'|'danger'
 *   size?: 'sm'|'md'
 *   icon?: React.ReactNode
 *   iconPosition?: 'left'|'right'
 *   loading?: boolean
 *   disabled?: boolean
 *   className?: string
 *   children?: React.ReactNode
 *   onClick?: () => void
 * }} props
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className,
  children,
  onClick,
  ...rest
}) {
  return (
    <motion.button
      whileTap={disabled || loading ? {} : { scale: 0.98, y: 1 }}
      transition={{ duration: 0.1 }}
      className={cn(BASE, SIZE[size], VARIANT[variant], className)}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {/* Icon + label are above the ::before fill layer */}
      {loading ? (
        <span className="relative z-10">
          <LoadingDots />
        </span>
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <span className="relative z-10 shrink-0">{icon}</span>
          )}
          {children && (
            <span className="relative z-10">{children}</span>
          )}
          {icon && iconPosition === 'right' && (
            <span className="relative z-10 shrink-0">{icon}</span>
          )}
        </>
      )}
    </motion.button>
  )
}
