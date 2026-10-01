import { motion } from 'framer-motion'
import { Card } from '../ui/Card.jsx'
import { cn } from '../../lib/cn.js'

/**
 * LossWaterfall (Fig. 03) — custom SVG waterfall chart.
 * Decomposes Expected to Actual generation across all loss categories.
 * Bars labeled in MWh and %, growing in sequence. Unexplained bar in grey.
 */
export function LossWaterfallChart({ waterfall }) {
  const plantWf = waterfall?.plantWaterfall || {
    expectedKwh: 48500,
    actualKwh: 39800,
    totalGapKwh: 8700,
    items: [
      { key: 'temperature', label: 'Temperature Derating', kwh: 3100, pctOfGap: 35.6 },
      { key: 'soiling', label: 'Uniform Soiling', kwh: 1950, pctOfGap: 22.4 },
      { key: 'shading', label: 'Partial Shading', kwh: 450, pctOfGap: 5.2 },
      { key: 'derating', label: 'Inverter Derating', kwh: 1200, pctOfGap: 13.8 },
      { key: 'string_faults', label: 'String Faults', kwh: 920, pctOfGap: 10.6 },
      { key: 'curtailment', label: 'Grid Curtailment', kwh: 0, pctOfGap: 0 },
      { key: 'unexplained', label: 'Unexplained', kwh: 1080, pctOfGap: 12.4 },
    ],
  }

  const expectedMwh = plantWf.expectedKwh / 1000
  const actualMwh = plantWf.actualKwh / 1000
  const totalGapMwh = plantWf.totalGapKwh / 1000

  // SVG chart dimensions
  const width = 800
  const height = 260
  const padLeft = 50
  const padRight = 20
  const padTop = 25
  const padBottom = 45

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  // Assemble full step list: [Expected, ...losses, Actual]
  const steps = [
    {
      key: 'expected',
      label: 'Expected',
      kwh: plantWf.expectedKwh,
      mwh: expectedMwh,
      isPillar: true,
      startMwh: 0,
      endMwh: expectedMwh,
      color: '#16150F', // ink
      darkColor: '#E9E6DC',
    },
  ]

  let runningMwh = expectedMwh
  for (const item of plantWf.items) {
    if (item.kwh <= 0) continue // Skip zero losses
    const itemMwh = item.kwh / 1000
    const startMwh = runningMwh
    const endMwh = Math.max(0, runningMwh - itemMwh)
    runningMwh = endMwh

    const isUnexplained = item.key === 'unexplained'
    steps.push({
      key: item.key,
      label: item.label,
      kwh: item.kwh,
      mwh: itemMwh,
      pctOfGap: item.pctOfGap,
      isPillar: false,
      startMwh,
      endMwh,
      color: isUnexplained ? '#4A473D' : '#B4441E', // Grey for unexplained, fault red for identified losses
      darkColor: isUnexplained ? '#8A8576' : '#D9790B',
    })
  }

  // End pillar: Actual
  steps.push({
    key: 'actual',
    label: 'Actual',
    kwh: plantWf.actualKwh,
    mwh: actualMwh,
    isPillar: true,
    startMwh: 0,
    endMwh: actualMwh,
    color: '#D9790B', // Amber
    darkColor: '#D9790B',
  })

  // Y-axis scaling
  const maxY = expectedMwh * 1.15 || 10
  const getY = (mwh) => padTop + chartH - (Math.max(0, mwh) / maxY) * chartH

  // X-axis bar positions
  const barCount = steps.length
  const colWidth = chartW / barCount
  const barWidth = Math.min(50, colWidth * 0.72)

  const isKwhScale = (plantWf.expectedKwh || 0) < 1500
  const formatEnergy = (kwh) => isKwhScale ? `${Math.round(kwh)} kWh` : `${(kwh / 1000).toFixed(1)} MWh`
  const identifiedLossKwh = totalGapMwh * 1000 - (plantWf.items.find(i => i.key === 'unexplained')?.kwh || 0)

  return (
    <Card header="Generation Loss Disaggregation Waterfall" figure="03" className="space-y-4">
      {/* Subtitle / summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-line dark:border-console-line pb-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-ink dark:bg-console-text inline-block rounded-[1px]" />
            <span className="label text-ink dark:text-console-text">Expected ({formatEnergy(plantWf.expectedKwh)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-fault inline-block rounded-[1px]" />
            <span className="label text-fault">Identified Losses (-{formatEnergy(identifiedLossKwh)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-ink-2 dark:bg-console-line inline-block rounded-[1px]" />
            <span className="label text-ink-2 dark:text-console-text/60">Unexplained</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-accent inline-block rounded-[1px]" />
            <span className="label text-accent font-medium">Actual ({formatEnergy(plantWf.actualKwh)})</span>
          </div>
        </div>

        <span className="font-mono text-[11px] text-ink-2 dark:text-console-text/60">
          TOTAL YIELD GAP: -{formatEnergy(plantWf.totalGapKwh)} ({((plantWf.totalGapKwh / Math.max(1, plantWf.expectedKwh)) * 100).toFixed(1)}%)
        </span>
      </div>

      {/* SVG Canvas */}
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible min-w-[650px]"
        >
          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((tick) => {
            const y = padTop + chartH * (1 - tick)
            const val = maxY * tick
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
                  {val.toFixed(0)} MWh
                </text>
              </g>
            )
          })}

          {/* Waterfall Bars */}
          {steps.map((step, idx) => {
            const x = padLeft + idx * colWidth + (colWidth - barWidth) / 2
            const yTop = getY(Math.max(step.startMwh, step.endMwh))
            const yBottom = getY(Math.min(step.startMwh, step.endMwh))
            const bHeight = Math.max(3, yBottom - yTop)

            // Connecting line to next bar
            const nextStep = steps[idx + 1]
            const nextX = padLeft + (idx + 1) * colWidth + (colWidth - barWidth) / 2
            const connectY = getY(step.endMwh)

            return (
              <g key={step.key + idx}>
                {/* Horizontal connector line */}
                {nextStep && (
                  <line
                    x1={x + barWidth}
                    y1={connectY}
                    x2={nextX}
                    y2={connectY}
                    stroke="#D6D1C4"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                    className="dark:stroke-console-line"
                  />
                )}

                {/* Animated Bar */}
                <motion.rect
                  x={x}
                  y={yTop}
                  width={barWidth}
                  height={bHeight}
                  fill={step.color}
                  className={cn(step.key === 'unexplained' ? 'opacity-70' : 'opacity-90')}
                  initial={{ scaleY: 0, originY: 1 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: idx * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                />

                {/* Top value label */}
                <text
                  x={x + barWidth / 2}
                  y={yTop - 6}
                  textAnchor="middle"
                  className="font-mono text-[10px] font-semibold fill-ink dark:fill-console-text"
                >
                  {step.isPillar ? `${step.mwh.toFixed(1)}M` : `-${step.mwh.toFixed(1)}M`}
                </text>

                {/* % of gap label for loss steps */}
                {!step.isPillar && step.pctOfGap !== undefined && (
                  <text
                    x={x + barWidth / 2}
                    y={yBottom + 12}
                    textAnchor="middle"
                    className="font-mono text-[8px] fill-ink-2 dark:fill-console-text/60"
                  >
                    ({step.pctOfGap.toFixed(0)}%)
                  </text>
                )}

                {/* Bottom X-axis label */}
                <text
                  x={x + barWidth / 2}
                  y={padTop + chartH + 24}
                  textAnchor="middle"
                  className={cn(
                    'font-mono text-[9px] uppercase tracking-wider',
                    step.isPillar
                      ? 'fill-ink dark:fill-console-text font-bold'
                      : 'fill-ink-2 dark:fill-console-text/60'
                  )}
                >
                  {step.key.slice(0, 7)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </Card>
  )
}

export default LossWaterfallChart
