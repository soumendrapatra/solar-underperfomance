import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePlantStore } from '../store/usePlantStore.js'
import { useWorkOrderStore } from '../store/useWorkOrderStore.js'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { Stat, Badge, Button, Card, Skeleton } from '@/components/ui'
import { formatCurrency, formatMWh, formatPct } from '../lib/format.js'
import { cn } from '../lib/cn.js'

// Simple SVG sparkline component for daily PR trends
function PrSparkline({ values = [0.82, 0.81, 0.83, 0.79, 0.77, 0.78, 0.76] }) {
  if (!values || values.length === 0) return null
  const min = Math.min(...values) * 0.95
  const max = Math.max(...values) * 1.05
  const range = max - min || 1
  const width = 80
  const height = 22

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const isHealthy = values[values.length - 1] >= 0.80

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={isHealthy ? '#4F6B2A' : '#B4441E'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* End point dot */}
      {values.length > 0 && (
        <circle
          cx={width}
          cy={(height - ((values[values.length - 1] - min) / range) * height).toFixed(1)}
          r="2.5"
          fill={isHealthy ? '#4F6B2A' : '#B4441E'}
        />
      )}
    </svg>
  )
}

export default function Portfolio() {
  const navigate = useNavigate()
  const portfolio = usePlantStore((s) => s.portfolio)
  const diagnoses = usePlantStore((s) => s.diagnoses)
  const loading = usePlantStore((s) => s.loading)
  const setSelectedPlantId = usePlantStore((s) => s.setSelectedPlantId)
  const tickets = useWorkOrderStore((s) => s.tickets)

  const [hasAnimatedStagger, setHasAnimatedStagger] = useState(false)

  useEffect(() => {
    setHasAnimatedStagger(true)
  }, [])

  // Aggregate campus-wide metrics
  let totalCapacityKwp = 0
  let totalTodayActKwh = 0
  let totalTodayExpKwh = 0
  let totalLost7dKwh = 0
  let totalRevenueAtRiskInr = 0
  let openP1Count = 0

  for (const plant of portfolio) {
    totalCapacityKwp += plant.dcCapacityKwp || 0
    const diag = diagnoses[plant.id]
    if (diag?.summary) {
      totalTodayActKwh += diag.summary.actualEnergyKwh || 0
      totalTodayExpKwh += diag.summary.expectedEnergyKwh || 0
      totalLost7dKwh += diag.summary.lostEnergyKwh || 0
      totalRevenueAtRiskInr += diag.summary.revenueLossInr || 0
    }
  }

  // Count open P1 tickets
  openP1Count = tickets.filter((t) => t.priority === 'P1' && t.status !== 'verified').length

  const fleetPr = totalTodayExpKwh > 0 ? totalTodayActKwh / totalTodayExpKwh : 0.792

  // Top 5 issues that need attention
  const openTickets = tickets
    .filter((t) => t.status !== 'verified')
    .sort((a, b) => (a.priority === 'P1' ? -1 : b.priority === 'P1' ? 1 : 0))
    .slice(0, 5)

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="CAMPUS SOLAR MONITORING"
        title="Campus Overview"
        description="Real-time rooftop solar digital twin monitoring, yield gap decomposition, and prescriptive fault diagnosis for Government College of Engineering Kalahandi."
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/app/work-orders')}
        >
          Maintenance Tasks ({tickets.filter((t) => t.status !== 'verified').length})
        </Button>
      </PageHeader>

      {/* ── Stat Row: 7 Key KPIs ────────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat
          label="CAPACITY"
          value={totalCapacityKwp}
          unit="kWp"
          decimals={0}
        />
        <Stat
          label="TODAY GEN"
          value={parseFloat(totalTodayActKwh.toFixed(1))}
          unit="kWh"
          decimals={1}
        />
        <Stat
          label="EXP GEN"
          value={parseFloat(totalTodayExpKwh.toFixed(1))}
          unit="kWh"
          decimals={1}
        />
        <Stat
          label="CAMPUS PR"
          value={parseFloat((fleetPr * 100).toFixed(1))}
          unit="%"
          decimals={1}
          delta={fleetPr >= 0.80 ? 0.015 : -0.025}
          deltaLabel="vs baseline"
        />
        <Stat
          label="LOST GEN 7D"
          value={parseFloat(totalLost7dKwh.toFixed(1))}
          unit="kWh"
          decimals={1}
          deltaPositiveIsGood={false}
        />
        <Stat
          label="VAL AT RISK 7D"
          value={totalRevenueAtRiskInr}
          unit="INR"
          decimals={0}
          deltaPositiveIsGood={false}
        />
        <Stat
          label="OPEN P1"
          value={openP1Count}
          unit="WO"
          decimals={0}
          deltaPositiveIsGood={false}
        />
      </section>

      {/* ── Plant Table ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="label text-ink dark:text-console-text">OPERATIONAL ASSETS</span>
          <span className="label text-ink-2 dark:text-console-text/60">
            {portfolio.length} ZONES REPORTING
          </span>
        </div>

        <Card noPadding className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line dark:border-console-line bg-paper-2/40 dark:bg-console-panel">
                <th className="py-2.5 px-4 label text-ink-2 dark:text-console-text/60 font-normal">BUILDING ZONE</th>
                <th className="py-2.5 px-3 label text-ink-2 dark:text-console-text/60 font-normal">ROOF / TILT</th>
                <th className="py-2.5 px-3 label text-ink-2 dark:text-console-text/60 font-normal text-right">CAPACITY</th>
                <th className="py-2.5 px-3 label text-ink-2 dark:text-console-text/60 font-normal text-right">PR</th>
                <th className="py-2.5 px-3 label text-ink-2 dark:text-console-text/60 font-normal text-right">LOSS %</th>
                <th className="py-2.5 px-3 label text-ink-2 dark:text-console-text/60 font-normal">STATUS</th>
                <th className="py-2.5 px-3 label text-ink-2 dark:text-console-text/60 font-normal text-right">VAL AT RISK (7D)</th>
                <th className="py-2.5 px-4 label text-ink-2 dark:text-console-text/60 font-normal text-center">PR TREND (7D)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-line/60 dark:border-console-line/60">
                    <td className="py-3 px-4"><Skeleton className="h-4 w-36" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3 px-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="py-3 px-3 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                    <td className="py-3 px-3 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    <td className="py-3 px-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-20 mx-auto" /></td>
                  </tr>
                ))
              ) : portfolio.map((plant, idx) => {
                const diag = diagnoses[plant.id]
                const summary = diag?.summary
                const pr = summary?.plantPr ?? 0.81
                const lostKwh = summary?.lostEnergyKwh ?? 120
                const expKwh = summary?.expectedEnergyKwh ?? 1200
                const lossPct = expKwh > 0 ? (lostKwh / expKwh) * 100 : 0
                const revLoss = summary?.revenueLossInr ?? 780

                // Top issue badge
                const topTicket = tickets.find((t) => t.plantId === plant.id && t.status !== 'verified')
                let topIssue = { label: 'HEALTHY', variant: 'ok' }
                if (topTicket) {
                  const varMap = { P1: 'critical', P2: 'high', P3: 'medium' }
                  topIssue = {
                    label: topTicket.modeName.toUpperCase(),
                    variant: varMap[topTicket.priority] || 'medium',
                  }
                } else if (diag?.fusedModes?.[0]) {
                  topIssue = {
                    label: diag.fusedModes[0].mode.replace(/_/g, ' ').toUpperCase(),
                    variant: diag.fusedModes[0].isHardwareTicket ? 'high' : 'info',
                  }
                }

                // Synthetic 7-day sparkline points
                const sparkPoints = [
                  pr * 1.02,
                  pr * 1.01,
                  pr * 1.03,
                  pr * 0.99,
                  pr * 0.98,
                  pr * 0.99,
                  pr,
                ]

                return (
                  <motion.tr
                    key={plant.id}
                    initial={hasAnimatedStagger ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.2 }}
                    onClick={() => {
                      setSelectedPlantId(plant.id)
                      navigate(`/app/plant/${plant.id}`)
                    }}
                    className="border-b border-line/60 dark:border-console-line/60 hover:bg-paper-2 dark:hover:bg-console-panel cursor-pointer transition-colors group"
                  >
                    {/* Plant Name */}
                    <td className="py-3 px-4 font-sans font-medium text-ink dark:text-console-text group-hover:text-accent transition-colors">
                      <div className="flex items-center gap-2">
                        <span>{plant.name}</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-accent">→</span>
                      </div>
                    </td>

                    {/* Tilt & Azimuth */}
                    <td className="py-3 px-3 text-ink-2 dark:text-console-text/70 font-mono text-[11px]">
                      {plant.tiltDeg}° tilt · {plant.azimuthDeg === 180 ? 'South' : plant.azimuthDeg > 180 ? 'SW' : 'SE'}
                    </td>

                    {/* Capacity */}
                    <td className="py-3 px-3 font-mono text-right tabular-nums text-ink dark:text-console-text">
                      {plant.dcCapacityKwp} kWp
                    </td>

                    {/* PR */}
                    <td className="py-3 px-3 font-mono text-right tabular-nums">
                      <span className={cn(pr >= 0.8 ? 'text-ok font-medium' : 'text-fault font-medium')}>
                        {(pr * 100).toFixed(1)} %
                      </span>
                    </td>

                    {/* Loss % */}
                    <td className="py-3 px-3 font-mono text-right tabular-nums text-ink-2 dark:text-console-text/70">
                      -{lossPct.toFixed(1)} %
                    </td>

                    {/* Top Issue Badge */}
                    <td className="py-3 px-3">
                      <Badge variant={topIssue.variant}>{topIssue.label}</Badge>
                    </td>

                    {/* Revenue at Risk */}
                    <td className="py-3 px-3 font-mono text-right tabular-nums text-ink dark:text-console-text">
                      {formatCurrency(revLoss)}
                    </td>

                    {/* Daily PR Sparkline */}
                    <td className="py-3 px-4 flex items-center justify-center">
                      <PrSparkline values={sparkPoints} />
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </section>

      {/* ── "Maintenance attention required": Top 5 Prioritized Diagnoses */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="label text-ink dark:text-console-text">MAINTENANCE ATTENTION REQUIRED</span>
            <span className="w-1.5 h-1.5 rounded-full bg-fault animate-pulse" />
          </div>
          <span className="label text-ink-2 dark:text-console-text/60">
            TOP PRIORITIZED CAMPUS ANOMALIES
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border border-line dark:border-console-line bg-paper dark:bg-console-panel space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : openTickets.length === 0 ? (
          <Card>
            <div className="p-6 text-center text-xs text-ink-2 dark:text-console-text/60 font-sans">
              No active critical or high-priority tickets. All fleet systems operating within nominal tolerances.
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {openTickets.map((ticket) => {
              const plant = portfolio.find((p) => p.id === ticket.plantId)
              const badgeVariant =
                ticket.priority === 'P1'
                  ? 'critical'
                  : ticket.priority === 'P2'
                  ? 'high'
                  : 'medium'

              return (
                <div
                  key={ticket.id}
                  className="p-4 border border-line dark:border-console-line bg-paper dark:bg-console-panel flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-ink-2 dark:hover:border-console-text/40"
                >
                  <div className="flex items-start gap-3">
                    <Badge variant={badgeVariant} className="mt-0.5 shrink-0">
                      {ticket.priority}
                    </Badge>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-ink dark:text-console-text">
                          {ticket.assetId}
                        </span>
                        <span className="label text-[10px] text-ink-2 dark:text-console-text/50">
                          {plant?.name || 'Plant'} · {ticket.modeName}
                        </span>
                        <span className="label text-[10px] text-ink-2/60">
                          {ticket.confidenceLabel} Confidence ({(ticket.confidence * 100).toFixed(0)}%)
                        </span>
                      </div>

                      <p className="font-sans text-xs text-ink dark:text-console-text leading-relaxed">
                        {ticket.text}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-line/50 dark:border-console-line/50">
                    <div className="text-right">
                      <span className="font-mono text-xs font-medium text-ink dark:text-console-text block tabular-nums">
                        {formatCurrency(ticket.lostRevenue)}
                      </span>
                      <span className="font-mono text-[10px] text-ink-2 dark:text-console-text/50">
                        {ticket.lostKWh} kWh lost
                      </span>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/app/diagnosis/${ticket.mode || 'thermal_derating'}`)}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
