import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePlantStore } from '../../store/usePlantStore.js'
import { cn } from '../../lib/cn.js'

// Simple inline SVG icons — 1.5px stroke, no icon library
function IconPortfolio() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9" y="2" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" />
      <rect x="9" y="9" width="5" height="5" />
    </svg>
  )
}

function IconWorkOrders() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2.5h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" />
      <path d="M5 6h6M5 9h4M5 12h2" />
    </svg>
  )
}

function IconLab() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2v4l-3 6.5A1.5 1.5 0 0 0 4.3 14h7.4a1.5 1.5 0 0 0 1.3-1.5L10 6V2" />
      <path d="M5 2h6M4 11h8" />
    </svg>
  )
}

function IconDataHealth() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8.5h3l2-5 3 10 2-5h4" />
    </svg>
  )
}

function IconModel() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2a6 6 0 0 0 0 12M2 8h12" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
    </svg>
  )
}

function IconMethodology() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M4 6h8M4 9h6M4 12h4" />
    </svg>
  )
}

function IconCollapse({ isCollapsed }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('transition-transform duration-200', isCollapsed ? 'rotate-180' : '')}
    >
      <path d="M11 3L6 8l5 5" />
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/app', label: 'Campus Overview', icon: IconPortfolio, exact: true },
  { to: '/app/work-orders', label: 'Maintenance', icon: IconWorkOrders },
  { to: '/app/lab', label: 'Scenario Lab', icon: IconLab },
  { to: '/app/data-health', label: 'Data Health', icon: IconDataHealth },
  { to: '/app/model', label: 'Model Evaluation', icon: IconModel },
  { to: '/app/methodology', label: 'Methodology', icon: IconMethodology },
  { to: '/app/settings', label: 'Settings', icon: IconSettings },
]

export function Sidebar({ isCollapsed, onToggleCollapse }) {
  const location = useLocation()
  const portfolio = usePlantStore((s) => s.portfolio)
  const selectedPlantId = usePlantStore((s) => s.selectedPlantId)
  const setSelectedPlantId = usePlantStore((s) => s.setSelectedPlantId)
  const diagnoses = usePlantStore((s) => s.diagnoses)

  // Status line timing
  const currentDiag = diagnoses[selectedPlantId]
  const lastTimingSec = currentDiag?.timings?.totalMs
    ? (currentDiag.timings.totalMs / 1000).toFixed(1)
    : '1.8'

  return (
    <>
      <motion.aside
        animate={{ width: isCollapsed ? 64 : 232 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="hidden md:flex shrink-0 h-screen border-r border-line dark:border-console-line bg-paper dark:bg-console-panel flex-col justify-between select-none relative z-20 overflow-hidden"
      >
      {/* ── Top: Brand Wordmark & Collapse Button ──────────────────────── */}
      <div>
        <div className="h-12 border-b border-line dark:border-console-line flex items-center justify-between px-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-display text-lg font-medium tracking-tight text-ink dark:text-console-text">
              SolarPower
            </span>
            {!isCollapsed && (
              <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border border-line dark:border-console-line bg-paper-2 dark:bg-console-bg text-accent font-semibold">
                CAMPUS
              </span>
            )}
          </div>

          <button
            onClick={onToggleCollapse}
            className="text-ink-2 dark:text-console-text/60 hover:text-ink dark:hover:text-console-text p-1 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <IconCollapse isCollapsed={isCollapsed} />
          </button>
        </div>

        {/* ── Navigation items ─────────────────────────────────────────── */}
        <nav className="p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = item.exact
              ? location.pathname === item.to || location.pathname.startsWith('/app/plant')
              : location.pathname.startsWith(item.to)

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2 text-xs font-sans rounded-[2px] transition-colors group',
                  isActive
                    ? 'text-ink dark:text-console-text font-medium bg-paper-2/60 dark:bg-console-bg/80'
                    : 'text-ink-2 dark:text-console-text/70 hover:text-ink dark:hover:text-console-text hover:bg-paper-2/30 dark:hover:bg-console-bg/40'
                )}
                title={isCollapsed ? item.label : undefined}
              >
                {/* 2px sliding amber left bar */}
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent"
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}

                <span className="shrink-0 text-current">
                  <Icon />
                </span>

                {!isCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>

      {/* ── Bottom: Plant Switcher & Engine Status Line ───────────────── */}
      <div className="border-t border-line dark:border-console-line p-3 space-y-2.5">
        {!isCollapsed ? (
          <>
            <div>
              <span className="label text-[9px] text-ink-2/70 dark:text-console-text/50 block mb-1">
                CAMPUS ROOF ZONE
              </span>
              <select
                value={selectedPlantId}
                onChange={(e) => setSelectedPlantId(e.target.value)}
                className="w-full text-xs font-sans bg-paper-2 dark:bg-console-bg border border-line dark:border-console-line text-ink dark:text-console-text px-2 py-1.5 focus:outline-none cursor-pointer"
              >
                {portfolio.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-1">
              <span className="font-mono text-[10px] text-ink-2/70 dark:text-console-text/50 block truncate">
                Engine idle · last run {lastTimingSec} s
              </span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <span
              className="w-2 h-2 rounded-full bg-ok"
              title={`Engine idle · last run ${lastTimingSec} s`}
            />
          </div>
        )}
      </div>
    </motion.aside>

      {/* ── Mobile Bottom Bar Navigation ─────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-paper dark:bg-console-panel border-t border-line dark:border-console-line flex items-center justify-around z-40 px-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = item.exact
            ? location.pathname === item.to || location.pathname.startsWith('/app/plant')
            : location.pathname.startsWith(item.to)

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center p-1.5 rounded-[2px] transition-colors',
                isActive
                  ? 'text-accent font-medium'
                  : 'text-ink-2 dark:text-console-text/60 hover:text-ink'
              )}
            >
              <Icon />
              <span className="text-[9px] font-mono tracking-tight mt-0.5 truncate max-w-[54px]">
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}

export default Sidebar
