import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlantStore } from '../../store/usePlantStore.js'
import { useWorkOrderStore } from '../../store/useWorkOrderStore.js'
import { Kbd } from '../ui/Kbd.jsx'
import { cn } from '../../lib/cn.js'

export function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const portfolio = usePlantStore((s) => s.portfolio)
  const selectedPlantId = usePlantStore((s) => s.selectedPlantId)
  const setSelectedPlantId = usePlantStore((s) => s.setSelectedPlantId)
  const tickets = useWorkOrderStore((s) => s.tickets)

  // Build searchable index
  const items = []

  // 1. Navigation Pages
  items.push(
    { id: 'page-portfolio', category: 'Pages', title: 'Portfolio Overview', path: '/app' },
    { id: 'page-wo', category: 'Pages', title: 'Work Orders & CMMS', path: '/app/work-orders' },
    { id: 'page-lab', category: 'Pages', title: 'Scenario Lab & Simulation', path: '/app/lab' },
    { id: 'page-health', category: 'Pages', title: 'Data Health & Sanity QC', path: '/app/data-health' },
    { id: 'page-model', category: 'Pages', title: 'Physics Digital Twin & Model', path: '/app/model' },
    { id: 'page-settings', category: 'Pages', title: 'Plant & Telemetry Settings', path: '/app/settings' }
  )

  // 2. Plants
  for (const plant of portfolio) {
    items.push({
      id: `plant-${plant.id}`,
      category: 'Plants',
      title: `${plant.name} (${(plant.dcCapacityKwp / 1000).toFixed(1)} MWp)`,
      action: () => {
        setSelectedPlantId(plant.id)
        navigate(`/app/plant/${plant.id}`)
      },
    })
  }

  // 3. Inverters of active plant
  const activePlant = portfolio.find((p) => p.id === selectedPlantId) || portfolio[0]
  if (activePlant?.inverters) {
    for (const inv of activePlant.inverters) {
      items.push({
        id: `inv-${inv.id}`,
        category: 'Inverters',
        title: `${inv.id} · ${activePlant.name} (${inv.pAcRated} kWac)`,
        path: `/app/plant/${activePlant.id}?inverter=${inv.id}`,
      })
    }
  }

  // 4. Work Orders
  for (const ticket of tickets.slice(0, 8)) {
    items.push({
      id: `ticket-${ticket.id}`,
      category: 'Work Orders',
      title: `${ticket.id} · [${ticket.priority}] ${ticket.assetId} - ${ticket.modeName}`,
      path: '/app/work-orders',
    })
  }

  // Filter items by query
  const q = query.trim().toLowerCase()
  const filtered = q
    ? items.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q)
      )
    : items

  // Keyboard navigation
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [isOpen])

  const handleSelect = (item) => {
    if (!item) return
    onClose()
    if (item.action) {
      item.action()
    } else if (item.path) {
      navigate(item.path)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(filtered[selectedIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/40 dark:bg-black/60 backdrop-blur-[2px]"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-xl bg-paper dark:bg-console-panel border border-line dark:border-console-line shadow-none overflow-hidden"
          >
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3 border-b border-line dark:border-console-line gap-3">
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-ink-2 dark:text-console-text/60 shrink-0"
              >
                <circle cx="6" cy="6" r="4.5" />
                <path d="M9.5 9.5L13 13" />
              </svg>

              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search plants, inverters, diagnoses, pages..."
                className="w-full bg-transparent text-sm font-sans text-ink dark:text-console-text placeholder:text-ink-2/50 dark:placeholder:text-console-text/40 focus:outline-none"
              />

              <Kbd>Esc</Kbd>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-line/40 dark:divide-console-line/40">
              {filtered.length === 0 ? (
                <div className="p-6 text-center label text-ink-2 dark:text-console-text/50">
                  No matching assets or commands found
                </div>
              ) : (
                filtered.map((item, idx) => {
                  const isSelected = idx === selectedIndex
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'px-4 py-2.5 flex items-center justify-between cursor-pointer text-xs transition-colors',
                        isSelected
                          ? 'bg-paper-2 dark:bg-console-bg text-ink dark:text-console-text'
                          : 'text-ink-2 dark:text-console-text/80'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="label text-[10px] w-20 shrink-0 opacity-70">
                          {item.category}
                        </span>
                        <span className={cn('font-sans', isSelected ? 'font-medium' : '')}>
                          {item.title}
                        </span>
                      </div>

                      {isSelected && (
                        <span className="label text-[10px] text-accent">Jump ↵</span>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer with key hints */}
            <div className="px-4 py-2 bg-paper-2 dark:bg-console-bg border-t border-line dark:border-console-line flex items-center justify-between text-[11px] text-ink-2 dark:text-console-text/60">
              <div className="flex items-center gap-2">
                <span>Navigate</span>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <span className="ml-2">Select</span>
                <Kbd>↵</Kbd>
              </div>
              <span className="font-mono text-[10px]">KIRAN COMMAND</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default CommandPalette
