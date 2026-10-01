import { Badge } from '../ui/Badge.jsx'

/**
 * Small SVG Weather Strip displaying real-time environmental conditions:
 * POA irradiance, ambient temperature, cell temperature, and wind speed.
 */
export function WeatherStrip({ weather = {} }) {
  const poa = weather.poaCorrected !== undefined ? weather.poaCorrected : (weather.poa ?? 982)
  const tAmb = weather.tAmb ?? 38.4
  const tCell = weather.tCell ?? weather.tModule ?? 56.2
  const wind = weather.wind ?? 3.2
  const cloudState = weather.cloudState || 'clear'

  return (
    <div className="flex items-center gap-4 flex-wrap border border-line dark:border-console-line bg-paper-2/60 dark:bg-console-panel px-3.5 py-1.5 rounded-[2px] text-xs font-mono select-none">
      {/* POA Irradiance */}
      <div className="flex items-center gap-1.5" title="Plane-of-Array Irradiance">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent shrink-0">
          <circle cx="8" cy="8" r="3.5" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
        </svg>
        <span className="text-ink-2 dark:text-console-text/60 text-[10px]">POA:</span>
        <span className="font-semibold text-ink dark:text-console-text tabular-nums">{poa.toFixed(0)} W/m²</span>
      </div>

      <span className="text-line dark:text-console-line">|</span>

      {/* Ambient Temp */}
      <div className="flex items-center gap-1.5" title="Ambient Air Temperature">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-warn shrink-0">
          <path d="M8 2a2 2 0 0 0-2 2v6.5a3.5 3.5 0 1 0 4 0V4a2 2 0 0 0-2-2z" />
          <circle cx="8" cy="11" r="1.5" fill="currentColor" />
        </svg>
        <span className="text-ink-2 dark:text-console-text/60 text-[10px]">TAMB:</span>
        <span className="font-medium text-ink dark:text-console-text tabular-nums">{tAmb.toFixed(1)}°C</span>
      </div>

      <span className="text-line dark:text-console-line">|</span>

      {/* Cell Temp */}
      <div className="flex items-center gap-1.5" title="PV Cell Junction Temperature (SAPM)">
        <span className="text-ink-2 dark:text-console-text/60 text-[10px]">TCELL:</span>
        <span className="font-medium text-ink dark:text-console-text tabular-nums">{tCell.toFixed(1)}°C</span>
      </div>

      <span className="text-line dark:text-console-line">|</span>

      {/* Wind Speed */}
      <div className="flex items-center gap-1.5" title="Wind Speed at 10m">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-info shrink-0">
          <path d="M2 5h8a2 2 0 1 0-2-2M2 8h10a2 2 0 1 1-2 2M2 11h6a1.5 1.5 0 1 0-1.5-1.5" />
        </svg>
        <span className="text-ink-2 dark:text-console-text/60 text-[10px]">WIND:</span>
        <span className="font-medium text-ink dark:text-console-text tabular-nums">{wind.toFixed(1)} m/s</span>
      </div>

      <Badge variant={cloudState === 'clear' ? 'ok' : cloudState === 'scattered' ? 'warn' : 'info'} className="ml-1">
        {cloudState.toUpperCase()}
      </Badge>
    </div>
  )
}

export default WeatherStrip
