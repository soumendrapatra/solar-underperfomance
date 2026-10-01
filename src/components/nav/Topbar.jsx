import { usePlantStore } from '../../store/usePlantStore.js'
import { useSettingsStore } from '../../store/useSettingsStore.js'
import { Badge } from '../ui/Badge.jsx'

/**
 * App topbar — displays active plant selection, fleet KPIs,
 * real-time worker pipeline progress, and theme switcher.
 */
export default function Topbar() {
  const portfolio = usePlantStore((s) => s.portfolio)
  const selectedPlantId = usePlantStore((s) => s.selectedPlantId)
  const setSelectedPlantId = usePlantStore((s) => s.setSelectedPlantId)
  const loading = usePlantStore((s) => s.loading)
  const stageProgress = usePlantStore((s) => s.stageProgress)
  const diagnoses = usePlantStore((s) => s.diagnoses)

  const theme = useSettingsStore((s) => s.theme)
  const toggleTheme = useSettingsStore((s) => s.toggleTheme)

  const activePlant = portfolio.find((p) => p.id === selectedPlantId) || portfolio[0]
  const currentDiag = diagnoses[selectedPlantId]

  return (
    <header className="h-10 shrink-0 border-b border-line bg-paper-2 flex items-center justify-between px-5 gap-3 select-none">
      {/* Left: Plant Switcher & Context */}
      <div className="flex items-center gap-3">
        <label htmlFor="plant-select" className="sr-only">Select Plant</label>
        <select
          id="plant-select"
          value={selectedPlantId}
          onChange={(e) => setSelectedPlantId(e.target.value)}
          className="font-display text-[14px] font-medium bg-transparent text-ink border-0 focus:outline-none cursor-pointer pr-2 hover:text-accent transition-colors"
        >
          {portfolio.map((p) => (
            <option key={p.id} value={p.id} className="bg-paper text-ink font-sans text-xs">
              {p.name}
            </option>
          ))}
        </select>

        <span className="hidden sm:inline label text-line">·</span>

        <span className="hidden sm:inline label text-ink-2">
          {activePlant?.location?.region || 'India'} · {(activePlant?.dcCapacityKwp / 1000).toFixed(1)} MWp DC
        </span>

        {/* Diagnostic PR / Health indicator */}
        {currentDiag?.summary && (
          <div className="hidden md:flex items-center gap-2 ml-2">
            <Badge variant={currentDiag.summary.plantPr >= 0.80 ? 'ok' : 'medium'}>
              PR {(currentDiag.summary.plantPr * 100).toFixed(1)} %
            </Badge>
            {currentDiag.summary.openTicketsCount > 0 && (
              <Badge variant="high">
                {currentDiag.summary.openTicketsCount} WO
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Right: Worker Stage Progress & Theme Switcher */}
      <div className="flex items-center gap-4">
        {loading && stageProgress?.stage && (
          <div className="flex items-center gap-2">
            <span className="label text-accent truncate max-w-[200px]">
              {stageProgress.stage}
            </span>
            <span className="font-mono text-[10px] text-ink-2">
              {stageProgress.pct}%
            </span>
          </div>
        )}

        {/* Theme Toggle (Paper / Console) */}
        <button
          onClick={toggleTheme}
          className="label text-ink-2 hover:text-ink px-2 py-1 rounded-sm border border-transparent hover:border-line transition-colors flex items-center gap-1.5"
          title={`Switch to ${theme === 'paper' ? 'Console (dark)' : 'Paper (light)'} theme`}
        >
          <span>{theme === 'paper' ? 'CONSOLE' : 'PAPER'}</span>
        </button>
      </div>
    </header>
  )
}
