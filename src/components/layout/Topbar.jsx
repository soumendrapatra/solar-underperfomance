import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { usePlantStore } from '../../store/usePlantStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { Kbd } from '../ui/Kbd.jsx'
import { cn } from '../../lib/cn.js'

// Inline SVG Console/Paper mode icon — 1.5px stroke
function IconTheme({ theme }) {
  if (theme === 'console') {
    // Sun icon for switching back to paper
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="3.5" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
      </svg>
    )
  }
  // Console terminal/screen wireframe icon for switching to dark console
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="9" rx="1" />
      <path d="M5 14h6M8 12v2M5 6.5l2 1.5-2 1.5M9 9.5h2" />
    </svg>
  )
}

export function Topbar({ onOpenCommandPalette }) {
  const location = useLocation()
  const [timeWindow, setTimeWindow] = useState('7D')

  const portfolio = usePlantStore((s) => s.portfolio)
  const selectedPlantId = usePlantStore((s) => s.selectedPlantId)
  const activePlant = portfolio.find((p) => p.id === selectedPlantId) || portfolio[0]

  const theme = useSettingsStore((s) => s.theme)
  const toggleTheme = useSettingsStore((s) => s.toggleTheme)

  // Compute dynamic breadcrumbs
  const getBreadcrumbs = () => {
    const parts = location.pathname.split('/').filter(Boolean)
    const crumbs = [{ label: 'PORTFOLIO', to: '/app' }]

    if (parts[1] === 'plant') {
      crumbs.push({ label: activePlant?.name?.toUpperCase() || 'PLANT', to: location.pathname })
    } else if (parts[1] === 'work-orders') {
      crumbs.push({ label: 'WORK ORDERS', to: '/app/work-orders' })
    } else if (parts[1] === 'lab') {
      crumbs.push({ label: 'SCENARIO LAB', to: '/app/lab' })
    } else if (parts[1] === 'data-health') {
      crumbs.push({ label: 'DATA HEALTH', to: '/app/data-health' })
    } else if (parts[1] === 'model') {
      crumbs.push({ label: 'MODEL REPORT', to: '/app/model' })
    } else if (parts[1] === 'settings') {
      crumbs.push({ label: 'SETTINGS', to: '/app/settings' })
    }

    return crumbs
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <header className="h-11 border-b border-line dark:border-console-line bg-paper dark:bg-console-panel flex items-center justify-between px-6 gap-4 select-none shrink-0">
      {/* ── Left: Breadcrumbs ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-hidden text-xs">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1
          return (
            <div key={crumb.to + idx} className="flex items-center gap-2">
              {idx > 0 && <span className="label text-line dark:text-console-line">/</span>}
              {isLast ? (
                <span className="label text-ink dark:text-console-text font-medium truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.to}
                  className="label text-ink-2 dark:text-console-text/60 hover:text-ink dark:hover:text-console-text transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Right: Controls (Time window, Command Palette hint, Console toggle) */}
      <div className="flex items-center gap-3">
        {/* Time Window Selector (Today / 7D / 30D) */}
        <div className="flex items-center border border-line dark:border-console-line bg-paper-2 dark:bg-console-bg rounded-[2px] p-0.5">
          {['Today', '7D', '30D'].map((window) => (
            <button
              key={window}
              onClick={() => setTimeWindow(window)}
              className={cn(
                'label text-[10px] px-2 py-0.5 transition-colors rounded-[2px]',
                timeWindow === window
                  ? 'bg-paper dark:bg-console-panel text-ink dark:text-console-text font-medium shadow-none border border-line/50 dark:border-console-line/50'
                  : 'text-ink-2 dark:text-console-text/60 hover:text-ink dark:hover:text-console-text'
              )}
            >
              {window}
            </button>
          ))}
        </div>

        {/* Command Palette Trigger Chip */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-xs border border-line dark:border-console-line bg-paper-2 dark:bg-console-bg text-ink-2 dark:text-console-text/60 hover:text-ink dark:hover:text-console-text transition-colors rounded-[2px]"
          title="Search or jump to asset (Ctrl+K)"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider">Search</span>
          <Kbd>Ctrl K</Kbd>
        </button>

        {/* Console Dark / Light Toggle (Inline SVG stroke) */}
        <button
          onClick={toggleTheme}
          className="p-1.5 border border-line dark:border-console-line text-ink-2 dark:text-console-text/70 hover:text-ink dark:hover:text-console-text hover:bg-paper-2 dark:hover:bg-console-bg transition-colors rounded-[2px]"
          title={`Switch to ${theme === 'paper' ? 'Console dark' : 'Paper light'} mode`}
          aria-label="Toggle theme"
        >
          <IconTheme theme={theme} />
        </button>
      </div>
    </header>
  )
}

export default Topbar
