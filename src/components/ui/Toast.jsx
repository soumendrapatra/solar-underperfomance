import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/cn.js'
import { useReducedMotion } from '../../hooks/useReducedMotion.js'

/** @type {React.Context<{ push: (msg: string, opts?: {variant?: string}) => void }>} */
const ToastCtx = createContext(null)

let _id = 0

/**
 * Wrap your app (or the dev kit) with ToastProvider to enable toasts.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const reduced = useReducedMotion()

  const push = useCallback((message, { variant = 'default' } = {}) => {
    const id = ++_id
    setToasts((t) => [...t, { id, message, variant }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 4000)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      {/* Bottom-left stack */}
      <div
        className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : 4 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex items-center gap-3 bg-ink text-paper font-mono text-[12px] px-4 py-2.5 border border-ink-2 min-w-[240px] max-w-xs"
            >
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="label text-paper/60 hover:text-paper shrink-0"
                aria-label="Dismiss"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

/** Returns the push(message, opts?) function. Must be inside ToastProvider. */
export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.push
}
