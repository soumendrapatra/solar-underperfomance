import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/cn.js'
import { useReducedMotion } from '../../hooks/useReducedMotion.js'

/**
 * @param {{
 *   tabs: Array<{ id: string; label: string }>
 *   defaultTab?: string
 *   onChange?: (id: string) => void
 *   className?: string
 * }} props
 */
export function Tabs({ tabs, defaultTab, onChange, className }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id)
  const reduced = useReducedMotion()

  function select(id) {
    setActive(id)
    onChange?.(id)
  }

  return (
    <div className={cn('flex border-b border-line gap-0', className)} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => select(tab.id)}
            className={cn(
              'relative px-4 py-2 label transition-colors duration-150',
              isActive ? 'text-ink' : 'text-ink-2 hover:text-ink'
            )}
          >
            {tab.label}
            {isActive && (
              <motion.span
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 40 }
                }
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
