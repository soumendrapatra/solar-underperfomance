import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/cn.js'

/**
 * Tooltip — wraps children and shows a small ink panel on hover/focus.
 *
 * @param {{
 *   content: React.ReactNode
 *   side?: 'top'|'bottom'|'left'|'right'
 *   className?: string
 *   children: React.ReactNode
 * }} props
 */
export function Tooltip({ content, side = 'top', className, children }) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), 80)
  }, [])

  const hide = useCallback(() => {
    clearTimeout(timerRef.current)
    setVisible(false)
  }, [])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const POSITION = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full  left-1/2 -translate-x-1/2 mt-1.5',
    left:   'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right:  'left-full  top-1/2 -translate-y-1/2 ml-1.5',
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={cn(
              'pointer-events-none absolute z-50 whitespace-nowrap',
              'bg-ink text-paper font-mono text-[10px] tracking-[0.04em] px-2 py-1',
              POSITION[side],
              className
            )}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
