import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '../ui/Card.jsx'
import { Badge } from '../ui/Badge.jsx'
import { cn } from '../../lib/cn.js'

/**
 * InverterHeatmap (Fig. 02) — custom SVG and layout-animated electrical grid.
 * Inverters as rows, SCB cells colored by string current ratio vs fleet median.
 * Clicking a row expands it in place to reveal individual per-string current bars (S01..S12).
 */
export function InverterHeatmap({ plant, telemetry }) {
  const [expandedInvId, setExpandedInvId] = useState('INV-01')

  const inverters = plant?.inverters || []
  // Get solar noon record (step index ~156) for midday electrical snapshot
  const noonRec = telemetry?.records?.[156] || telemetry?.records?.[Math.floor((telemetry?.records?.length || 1) / 2)] || {}
  const invDataMap = noonRec.inverters || {}

  // Calculate fleet median SCB current
  const allScbCurrents = []
  for (const invId in invDataMap) {
    const scbs = invDataMap[invId]?.scbs || {}
    for (const scbId in scbs) {
      if (scbs[scbId]?.iDc > 0) allScbCurrents.push(scbs[scbId].iDc)
    }
  }

  allScbCurrents.sort((a, b) => a - b)
  const medianScbCurrent = allScbCurrents.length > 0
    ? allScbCurrents[Math.floor(allScbCurrents.length / 2)]
    : 140

  const getRatioColor = (iDc) => {
    if (!iDc || medianScbCurrent <= 0) return 'bg-line/40 text-ink-2'
    const ratio = iDc / medianScbCurrent
    if (ratio >= 0.96) return 'bg-ok/20 border-ok text-ok'
    if (ratio >= 0.85) return 'bg-warn/25 border-warn text-warn'
    return 'bg-fault/25 border-fault text-fault'
  }

  const toggleExpand = (id) => {
    setExpandedInvId((prev) => (prev === id ? null : id))
  }

  return (
    <Card header="Combiner Box & String Current Matrix" figure="02" className="space-y-4">
      {/* Legend & Subtitle */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-line dark:border-console-line pb-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-ok/20 border border-ok inline-block rounded-[1px]" />
            <span className="label text-ink dark:text-console-text">Normal (≥ 96%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-warn/25 border border-warn inline-block rounded-[1px]" />
            <span className="label text-warn">Imbalance (85-95%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-fault/25 border border-fault inline-block rounded-[1px]" />
            <span className="label text-fault">Faulted (&lt; 85%)</span>
          </div>
        </div>

        <span className="font-mono text-[11px] text-ink-2 dark:text-console-text/60">
          CLICK ROW TO EXPAND PER-STRING CURRENTS (S01–S12)
        </span>
      </div>

      {/* Inverter Grid Rows */}
      <div className="space-y-1.5">
        {inverters.map((inv) => {
          const invId = inv.id
          const data = invDataMap[invId] || {}
          const isExpanded = expandedInvId === invId
          const pAc = data.pAc ?? 0
          const heatsink = data.heatsinkTemp ?? 45
          const status = data.status || 'NORMAL'

          // SCB combiner IDs
          const scbs = data.scbs || {
            'SCB-01': { iDc: 142.1, strings: [] },
            'SCB-02': { iDc: 141.8, strings: [] },
            'SCB-03': { iDc: 142.5, strings: [] },
            'SCB-04': { iDc: 141.2, strings: [] },
          }

          return (
            <motion.div
              key={invId}
              layout
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'border border-line dark:border-console-line bg-paper dark:bg-console-panel transition-colors rounded-[2px]',
                isExpanded ? 'border-accent dark:border-accent' : 'hover:border-ink-2/60 dark:hover:border-console-text/40'
              )}
            >
              {/* Row Header Bar */}
              <div
                onClick={() => toggleExpand(invId)}
                className="px-4 py-2.5 flex items-center justify-between cursor-pointer select-none gap-3"
              >
                {/* Left: Inverter ID & Status */}
                <div className="flex items-center gap-3 w-44 shrink-0">
                  <span className="font-mono text-xs font-semibold text-ink dark:text-console-text">
                    {invId}
                  </span>
                  <Badge variant={status === 'NORMAL' ? 'ok' : status === 'DERATED' ? 'critical' : 'info'}>
                    {status}
                  </Badge>
                </div>

                {/* Center: 4 SCB Combiner Cells */}
                <div className="flex-1 grid grid-cols-4 gap-2 max-w-md">
                  {['SCB-01', 'SCB-02', 'SCB-03', 'SCB-04'].map((scbId) => {
                    const scb = scbs[scbId]
                    const iDc = scb?.iDc ?? 0
                    const colorClass = getRatioColor(iDc)

                    return (
                      <div
                        key={scbId}
                        className={cn(
                          'px-2 py-1 border text-center font-mono text-[11px] rounded-[2px] transition-colors',
                          colorClass
                        )}
                        title={`${invId} ${scbId}: ${iDc.toFixed(1)} A`}
                      >
                        <span className="text-[9px] uppercase tracking-wider block opacity-70">
                          {scbId}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {iDc.toFixed(1)} A
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Right: Electrical KPIs & Expand toggle */}
                <div className="flex items-center gap-4 text-right shrink-0">
                  <div className="hidden sm:block">
                    <span className="font-mono text-xs text-ink dark:text-console-text block tabular-nums">
                      {pAc.toFixed(1)} kW
                    </span>
                    <span className="font-mono text-[10px] text-ink-2 dark:text-console-text/50">
                      {heatsink.toFixed(1)} °C heatsink
                    </span>
                  </div>

                  <span className="text-xs text-ink-2 dark:text-console-text/60 font-mono w-4 text-center">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {/* Expanded Detail Panel: Per-String Current Bars */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="border-t border-line/60 dark:border-console-line/60 bg-paper-2/40 dark:bg-console-bg p-4 space-y-4 overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="label text-[10px] text-ink dark:text-console-text">
                        MONITORED STRING CHANNELS (4 COMBINER BOXES × 12 STRINGS = 48 STRINGS)
                      </span>
                      <span className="font-mono text-[10px] text-ink-2 dark:text-console-text/60">
                        NOMINAL IMP ~ 12.5–13.2 A
                      </span>
                    </div>

                    {/* Combiner Box Groups */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {['SCB-01', 'SCB-02', 'SCB-03', 'SCB-04'].map((scbId) => {
                        const scb = scbs[scbId]
                        // Generate or extract string currents
                        const stringCurrents =
                          scb?.strings && scb.strings.length === 12
                            ? scb.strings
                            : Array.from({ length: 12 }, () => 12.8)

                        return (
                          <div
                            key={scbId}
                            className="p-2.5 border border-line/70 dark:border-console-line/70 bg-paper dark:bg-console-panel rounded-[2px] space-y-2"
                          >
                            <div className="flex items-center justify-between border-b border-line/40 dark:border-console-line/40 pb-1">
                              <span className="font-mono text-[11px] font-semibold text-ink dark:text-console-text">
                                {scbId}
                              </span>
                              <span className="font-mono text-[10px] text-ink-2 dark:text-console-text/60 tabular-nums">
                                {(scb?.iDc || 0).toFixed(1)} A total
                              </span>
                            </div>

                            {/* 12 String Bars */}
                            <div className="grid grid-cols-6 gap-1 pt-1">
                              {stringCurrents.map((iStr, sIdx) => {
                                const sNum = String(sIdx + 1).padStart(2, '0')
                                const isOpen = iStr < 0.3
                                const isLow = iStr < 10.0 && !isOpen

                                return (
                                  <div
                                    key={sNum}
                                    className={cn(
                                      'flex flex-col items-center p-1 border rounded-[1px] transition-colors',
                                      isOpen
                                        ? 'bg-fault/20 border-fault text-fault font-bold'
                                        : isLow
                                        ? 'bg-warn/20 border-warn text-warn'
                                        : 'bg-paper-2 dark:bg-console-bg border-line dark:border-console-line text-ink dark:text-console-text'
                                    )}
                                    title={`String S${sNum}: ${iStr.toFixed(2)} A`}
                                  >
                                    <span className="font-mono text-[8px] opacity-70">
                                      S{sNum}
                                    </span>
                                    <span className="font-mono text-[9px] tabular-nums font-medium mt-0.5">
                                      {isOpen ? '0.0A' : `${iStr.toFixed(1)}`}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </Card>
  )
}

export default InverterHeatmap
