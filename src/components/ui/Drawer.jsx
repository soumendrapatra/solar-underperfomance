import { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/cn.js'
import { useReducedMotion } from '../../hooks/useReducedMotion.js'

// All focusable elements (for focus trap)
const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'

/**
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   title?: string
 *   children: React.ReactNode
 *   width?: string    - Tailwind width class, default 'w-80'
 * }} props
 */
export function Drawer({ open, onClose, title, children, width = 'w-80' }) {
  const reduced = useReducedMotion()
  const panelRef = useRef(null)
  const lastFocusRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Save/restore focus and trap it inside the drawer
  useEffect(() => {
    if (open) {
      lastFocusRef.current = document.activeElement
      // Focus the panel itself after animation settles
      const t = setTimeout(() => {
        const first = panelRef.current?.querySelector(FOCUSABLE)
        first?.focus()
      }, 50)
      return () => clearTimeout(t)
    } else {
      lastFocusRef.current?.focus()
    }
  }, [open])

  const trapFocus = useCallback((e) => {
    if (!panelRef.current) return
    const focusable = Array.from(panelRef.current.querySelectorAll(FOCUSABLE))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.key === 'Tab') {
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      }
    }
  }, [])

  const slideX = reduced ? 0 : '100%'

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? 'Panel'}
            onKeyDown={trapFocus}
            className={cn(
              'fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-paper border-l border-line',
              width
            )}
            initial={{ x: slideX }}
            animate={{ x: 0 }}
            exit={{ x: slideX }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-line shrink-0">
              {title && <span className="label text-ink">{title}</span>}
              <button
                onClick={onClose}
                className="ml-auto label text-ink-2 hover:text-ink p-1 -mr-1"
                aria-label="Close"
              >
                {/* Inline SVG close — 1.5px stroke */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="2" y1="2" x2="12" y2="12" />
                  <line x1="12" y1="2" x2="2" y2="12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
