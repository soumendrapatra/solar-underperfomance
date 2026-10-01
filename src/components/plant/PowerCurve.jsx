import { useState, useRef } from 'react'
import { Card } from '../ui/Card.jsx'
import { Badge } from '../ui/Badge.jsx'
import { formatKW } from '../../lib/format.js'
import { cn } from '../../lib/cn.js'

/**
 * PowerCurve (Fig. 01) — custom high-precision SVG chart.
 * - Expected: dashed ink line
 * - Actual: solid amber line with stroke-dashoffset draw-in over 900 ms
 * - Yield gap: shaded in fault color (#B4441E) at 12% opacity
 * - Transient-excluded periods: faint hatched diagonal bands
 * - Interactive hover crosshair tooltip showing pExp, pAct, deltaP, POA, tCell, stable flag
 */
export function PowerCurve({ records = [], maxPac = 10000 }) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const svgRef = useRef(null)

  // Chart dimensions
  const width = 800
  const height = 280
  const padLeft = 55
  const padRight = 20
  const padTop = 20
  const padBottom = 35

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  // Filter or sample 1 day (e.g. 288 records)
  const dayRecords = records.slice(0, 288)
  const total = dayRecords.length || 1

  // Max scale calculation
  const maxKw = Math.max(
    maxPac * 1.05,
    ...dayRecords.map((r) => Math.max(r.pExp || 0, r.plantPexp || 0, r.pAct || 0, r.plantPact || 0))
  )

  const getY = (kw) => padTop + chartH - (Math.max(0, kw) / maxKw) * chartH
  const getX = (idx) => padLeft + (idx / (total - 1)) * chartW

  // Build points strings for Expected and Actual
  let actualPoints = []
  let expectedPoints = []
  let gapPolygons = []
  let transientBands = []

  let inTransient = false
  let transientStart = 0

  for (let i = 0; i < dayRecords.length; i++) {
    const r = dayRecords[i]
    const pAct = r.plantPact ?? r.pAct ?? (r.inverters ? Object.values(r.inverters).reduce((s, inv) => s + (inv.pAc || 0), 0) : 0)
    const pExp = r.plantPexp ?? r.pExp ?? (r.inverters ? Object.values(r.inverters).reduce((s, inv) => s + (inv.pExp || inv.pAc || 0), 0) : pAct)

    const x = getX(i)
    const yAct = getY(pAct)
    const yExp = getY(pExp)

    actualPoints.push(`${x.toFixed(1)},${yAct.toFixed(1)}`)
    expectedPoints.push(`${x.toFixed(1)},${yExp.toFixed(1)}`)

    // Identify transient periods
    const isTrans = r.weather?.isTransient || (!r.weather?.isStable && (r.weather?.poa || 0) > 100)
    if (isTrans && !inTransient) {
      inTransient = true
      transientStart = i
    } else if (!isTrans && inTransient) {
      inTransient = false
      transientBands.push({ start: transientStart, end: i - 1 })
    }
  }

  if (inTransient) {
    transientBands.push({ start: transientStart, end: dayRecords.length - 1 })
  }

  // Construct polygon for shaded gap between actual and expected
  const gapD =
    actualPoints.length > 0
      ? `M ${actualPoints[0]} ` +
        actualPoints.map((p) => `L ${p}`).join(' ') +
        ' ' +
        expectedPoints
          .slice()
          .reverse()
          .map((p) => `L ${p}`)
          .join(' ') +
        ' Z'
      : ''

  // Hover data
  const handleMouseMove = (e) => {
    if (!svgRef.current || dayRecords.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const clientX = e.clientX - rect.left
    const relX = (clientX / rect.width) * width
    const boundedX = Math.max(padLeft, Math.min(width - padRight, relX))
    const index = Math.round(((boundedX - padLeft) / chartW) * (total - 1))
    setHoverIndex(Math.max(0, Math.min(total - 1, index)))
  }

  const hoverRec = hoverIndex !== null ? dayRecords[hoverIndex] : null
  const hoverX = hoverIndex !== null ? getX(hoverIndex) : null

  // Hover values
  const hoverAct = hoverRec
    ? hoverRec.plantPact ?? hoverRec.pAct ?? (hoverRec.inverters ? Object.values(hoverRec.inverters).reduce((s, inv) => s + (inv.pAc || 0), 0) : 0)
    : 0
  const hoverExp = hoverRec
    ? hoverRec.plantPexp ?? hoverRec.pExp ?? (hoverRec.inverters ? Object.values(hoverRec.inverters).reduce((s, inv) => s + (inv.pExp || inv.pAc || 0), 0) : hoverAct)
    : 0
  const hoverDelta = Math.max(0, hoverExp - hoverAct)
  const hoverPoa = hoverRec?.weather?.poaCorrected ?? hoverRec?.weather?.poa ?? 0
  const hoverTcell = hoverRec?.weather?.tCell ?? hoverRec?.weather?.tModule ?? hoverRec?.weather?.tAmb ?? 25
  const hoverStable = hoverRec?.weather?.isStable ?? !hoverRec?.weather?.isTransient

  return (
    <Card header="Generation vs Expected Digital Twin" figure="01" className="space-y-4">
      {/* Legend & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-5">
          {/* Actual line */}
          <div className="flex items-center gap-2">
            <span className="w-4 h-[2px] bg-accent inline-block" />
            <span className="label text-ink dark:text-console-text">Actual Generation (Pac)</span>
          </div>

          {/* Expected line */}
          <div className="flex items-center gap-2">
            <span className="w-4 h-[2px] border-b border-dashed border-ink dark:border-console-text inline-block" />
            <span className="label text-ink-2 dark:text-console-text/60">Expected Twin (Pexp)</span>
          </div>

          {/* Yield gap shaded */}
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-fault/20 border border-fault/40 inline-block" />
            <span className="label text-fault">Yield Gap</span>
          </div>

          {/* Hatched transient */}
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-line/60 dark:bg-console-line/60 border border-line dark:border-console-line inline-block" />
            <span className="label text-ink-2 dark:text-console-text/50">Transient Excluded</span>
          </div>
        </div>

        <span className="font-mono text-[11px] text-ink-2 dark:text-console-text/60">
          5-MIN RESOLUTION · NOON PEAK {(maxPac / 1000).toFixed(1)} MWac
        </span>
      </div>

      {/* SVG Canvas */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            {/* Hatched pattern for transient cloud periods */}
            <pattern id="hatched" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#D6D1C4" strokeWidth="1.2" className="dark:stroke-console-line" />
            </pattern>

            {/* Subtle amber glow for actual line */}
            <filter id="amberGlow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#D9790B" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* Grid lines (horizontal power axis) */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((tick) => {
            const y = padTop + chartH * (1 - tick)
            const kw = maxKw * tick
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#D6D1C4"
                  strokeWidth="0.8"
                  className="dark:stroke-console-line/50"
                  strokeDasharray={tick === 0 ? undefined : '2 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="font-mono text-[9px] fill-ink-2 dark:fill-console-text/50"
                >
                  {(kw / 1000).toFixed(1)}M
                </text>
              </g>
            )
          })}

          {/* Time axis labels (06:00, 09:00, 12:00, 15:00, 18:00) */}
          {[6, 9, 12, 15, 18].map((hour) => {
            const stepIdx = (hour * 60) / 5
            const x = getX(stepIdx)
            return (
              <g key={hour}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={padTop + chartH}
                  stroke="#D6D1C4"
                  strokeWidth="0.5"
                  className="dark:stroke-console-line/30"
                  strokeDasharray="2 3"
                />
                <text
                  x={x}
                  y={padTop + chartH + 16}
                  textAnchor="middle"
                  className="font-mono text-[9px] fill-ink-2 dark:fill-console-text/50"
                >
                  {String(hour).padStart(2, '0')}:00
                </text>
              </g>
            )
          })}

          {/* Hatched Transient Bands */}
          {transientBands.map((band, idx) => {
            const x1 = getX(band.start)
            const x2 = getX(band.end)
            const bandW = Math.max(2, x2 - x1)
            return (
              <rect
                key={idx}
                x={x1}
                y={padTop}
                width={bandW}
                height={chartH}
                fill="url(#hatched)"
                opacity="0.65"
              />
            )
          })}

          {/* Shaded Gap between Expected and Actual */}
          {gapD && (
            <path
              d={gapD}
              fill="#B4441E"
              opacity="0.12"
            />
          )}

          {/* Expected Line (Dashed Ink) */}
          {expectedPoints.length > 0 && (
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              className="text-ink dark:text-console-text"
              points={expectedPoints.join(' ')}
            />
          )}

          {/* Actual Line (Solid Amber with CSS draw-in animation) */}
          {actualPoints.length > 0 && (
            <polyline
              fill="none"
              stroke="#D9790B"
              strokeWidth="2.0"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#amberGlow)"
              points={actualPoints.join(' ')}
              style={{
                strokeDasharray: 2000,
                strokeDashoffset: 0,
                animation: 'drawIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards',
              }}
            />
          )}

          {/* Hover Crosshair Cursor */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={hoverX}
                y1={padTop}
                x2={hoverX}
                y2={padTop + chartH}
                stroke="#16150F"
                strokeWidth="1"
                className="dark:stroke-console-text/60"
                strokeDasharray="2 2"
              />
              <circle
                cx={hoverX}
                cy={getY(hoverAct)}
                r="3.5"
                fill="#D9790B"
                stroke="#F3F0E8"
                strokeWidth="1.5"
                className="dark:stroke-console-panel"
              />
              <circle
                cx={hoverX}
                cy={getY(hoverExp)}
                r="3.0"
                fill="#16150F"
                stroke="#F3F0E8"
                strokeWidth="1"
                className="dark:fill-console-text dark:stroke-console-panel"
              />
            </g>
          )}
        </svg>

        {/* Hover Crosshair Tooltip Box */}
        {hoverRec && (
          <div
            className="absolute top-2 pointer-events-none z-20 border border-line dark:border-console-line bg-paper/95 dark:bg-console-panel/95 px-3 py-2 text-xs font-mono shadow-sm transition-all"
            style={{
              left: Math.min(width - 220, Math.max(10, hoverX - 90)),
            }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-line/60 dark:border-console-line/60 pb-1 mb-1.5">
              <span className="text-[10px] text-ink-2 dark:text-console-text/60">
                {(hoverRec.timestamp || '').slice(11, 16)} IST
              </span>
              <Badge variant={hoverStable ? 'ok' : 'info'}>
                {hoverStable ? 'STABLE' : 'TRANSIENT'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] tabular-nums">
              <span className="text-ink-2 dark:text-console-text/60">Actual (Pac):</span>
              <span className="text-accent font-medium text-right">{hoverAct.toFixed(1)} kW</span>

              <span className="text-ink-2 dark:text-console-text/60">Expected (Pexp):</span>
              <span className="text-ink dark:text-console-text font-medium text-right">{hoverExp.toFixed(1)} kW</span>

              <span className="text-ink-2 dark:text-console-text/60">Gap (ΔP):</span>
              <span className="text-fault font-medium text-right">-{hoverDelta.toFixed(1)} kW</span>

              <span className="text-ink-2 dark:text-console-text/60">POA / Tcell:</span>
              <span className="text-ink dark:text-console-text text-right">{hoverPoa.toFixed(0)} W / {hoverTcell.toFixed(1)}°C</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export default PowerCurve
