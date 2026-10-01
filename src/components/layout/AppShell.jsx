import { useState, useEffect } from 'react'
import { useLocation, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './Sidebar.jsx'
import { Topbar } from './Topbar.jsx'
import { CommandPalette } from './CommandPalette.jsx'
import { usePlantStore } from '../../store/usePlantStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { useReducedMotion } from '../../hooks/useReducedMotion.js'

export function AppShell() {
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const prefersReduced = useReducedMotion()

  const initialized = usePlantStore((s) => s.initialized)
  const loadPortfolio = usePlantStore((s) => s.loadPortfolio)
  const loading = usePlantStore((s) => s.loading)
  const stageProgress = usePlantStore((s) => s.stageProgress)

  const theme = useSettingsStore((s) => s.theme)

  // 1. Initial bootstrap
  useEffect(() => {
    if (!initialized) {
      loadPortfolio()
    }
  }, [initialized, loadPortfolio])

  // 2. Sync theme with root class
  useEffect(() => {
    if (theme === 'console') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // 3. Global keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-paper dark:bg-console-bg text-ink dark:text-console-text">
      {/* ── Global Worker Progress Bar ───────────────────────────────── */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between pointer-events-none">
          {/* Animated thin amber bar */}
          <div className="h-[2px] bg-accent w-full overflow-hidden">
            <motion.div
              className="h-full bg-accent"
              initial={{ width: '0%' }}
              animate={{ width: `${Math.max(5, stageProgress?.pct || 15)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Small mono stage label */}
          {stageProgress?.stage && (
            <div className="absolute right-4 top-1.5 px-2 py-0.5 bg-ink text-paper dark:bg-console-panel dark:text-console-text text-[10px] font-mono border border-line dark:border-console-line rounded-[2px] shadow-none">
              {stageProgress.stage} · {stageProgress.pct}%
            </div>
          )}
        </div>
      )}

      {/* ── Fixed Sidebar ────────────────────────────────────────────── */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
      />

      {/* ── Main Viewport Column ──────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onOpenCommandPalette={() => setIsCommandOpen(true)} />

        {/* ── Content area with Page Transition ───────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 pt-4 md:pt-6 pb-20 md:pb-6 scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  duration: prefersReduced ? 0.05 : 0.28,
                  ease: [0.22, 1, 0.36, 1],
                },
              }}
              exit={{
                opacity: 0,
                transition: { duration: prefersReduced ? 0.05 : 0.15 },
              }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Command Palette ───────────────────────────────────────────── */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
      />
    </div>
  )
}

export default AppShell
