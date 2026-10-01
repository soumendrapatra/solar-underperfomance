import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePlantStore } from '../store/usePlantStore.js'
import { useWorkOrderStore } from '../store/useWorkOrderStore.js'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { WeatherStrip } from '../components/plant/WeatherStrip.jsx'
import { PowerCurve } from '../components/plant/PowerCurve.jsx'
import { InverterHeatmap } from '../components/plant/InverterHeatmap.jsx'
import { LossWaterfallChart } from '../components/plant/LossWaterfallChart.jsx'
import { Badge, Button, Card, Drawer, Skeleton } from '@/components/ui'
import { formatCurrency } from '../lib/format.js'

export default function Plant() {
  const { plantId } = useParams()
  const navigate = useNavigate()

  const portfolio = usePlantStore((s) => s.portfolio)
  const selectedPlantId = usePlantStore((s) => s.selectedPlantId)
  const setSelectedPlantId = usePlantStore((s) => s.setSelectedPlantId)
  const telemetryCache = usePlantStore((s) => s.telemetryCache)
  const diagnoses = usePlantStore((s) => s.diagnoses)
  const loading = usePlantStore((s) => s.loading)

  const tickets = useWorkOrderStore((s) => s.tickets)

  const [selectedIssue, setSelectedIssue] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Resolve active plant
  const activePlantId = plantId || selectedPlantId || 'bhadla-block-c'
  const plant = portfolio.find((p) => p.id === activePlantId) || portfolio[0]

  useEffect(() => {
    if (plantId && plantId !== selectedPlantId) {
      setSelectedPlantId(plantId)
    }
  }, [plantId, selectedPlantId, setSelectedPlantId])

  const telemetry = telemetryCache[activePlantId]
  const diagnosis = diagnoses[activePlantId]

  // Midday weather snapshot for weather strip
  const noonRec = telemetry?.records?.[156] || telemetry?.records?.[0] || {}
  const weatherSnapshot = noonRec.weather || {}

  // Work orders and diagnostic issues for this plant
  const plantTickets = tickets.filter((t) => t.plantId === activePlantId)
  const plantModes = diagnosis?.fusedModes || []

  const handleOpenDetail = (issue) => {
    setSelectedIssue(issue)
    navigate(`/app/diagnosis/${issue.mode || issue.id || 'thermal_derating'}`)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* ── 1. Header: Name, Capacity, Location, Weather Strip ───────── */}
      <PageHeader
        eyebrow={`${plant?.location?.region?.toUpperCase() || 'RAJASTHAN'} · ${(plant?.dcCapacityKwp / 1000).toFixed(1)} MWp DC / ${(plant?.acCapacityKw / 1000).toFixed(0)} MWac`}
        title={plant?.name || 'Plant'}
        description={`Grid connection at 33 kV pooling substation. 8 central inverters, 32 combiner boxes, 384 string channels.`}
      >
        <WeatherStrip weather={weatherSnapshot} />
      </PageHeader>

      {/* ── 2. PowerCurve (Fig. 01) ─────────────────────────────────── */}
      <section>
        {loading ? (
          <div className="border border-line dark:border-console-line bg-paper dark:bg-console-panel p-6 space-y-4">
            <div className="h-6 w-1/4 bg-line/40 rounded animate-pulse" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <PowerCurve
            records={telemetry?.records || []}
            maxPac={plant?.acCapacityKw || 10000}
          />
        )}
      </section>

      {/* ── Two Column Grid: Heatmap (Fig. 02) + Waterfall (Fig. 03) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* ── 3. InverterHeatmap (Fig. 02) ───────────────────────────── */}
        <section>
          {loading ? (
            <div className="border border-line dark:border-console-line bg-paper dark:bg-console-panel p-6 space-y-4">
              <div className="h-6 w-1/3 bg-line/40 rounded animate-pulse" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : (
            <InverterHeatmap plant={plant} telemetry={telemetry} />
          )}
        </section>

        {/* ── 4. LossWaterfall (Fig. 03) ─────────────────────────────── */}
        <section>
          {loading ? (
            <div className="border border-line dark:border-console-line bg-paper dark:bg-console-panel p-6 space-y-4">
              <div className="h-6 w-1/3 bg-line/40 rounded animate-pulse" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : (
            <LossWaterfallChart waterfall={diagnosis?.waterfall} />
          )}
        </section>
      </div>

      {/* ── 5. Diagnosis Cards for this Plant (Shared layoutId transition) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-line dark:border-console-line pb-2">
          <div className="flex items-center gap-2">
            <span className="label text-ink dark:text-console-text">ACTIVE PLANT ANOMALIES & DIAGNOSES</span>
            <span className="font-mono text-xs text-ink-2 dark:text-console-text/60">
              ({plantModes.length} IDENTIFIED)
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app/work-orders')}
          >
            All Work Orders →
          </Button>
        </div>

        {plantModes.length === 0 ? (
          <Card>
            <div className="p-8 text-center text-xs font-sans text-ink-2 dark:text-console-text/60">
              No anomalies diagnosed for this plant. All strings, combiners, and inverters operating within normal performance envelopes.
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plantModes.map((item, idx) => {
              const matchingTicket = plantTickets.find((t) => t.mode === item.mode)
              const cardId = `diag-${activePlantId}-${item.mode}`
              const isHardware = item.isHardwareTicket

              return (
                <motion.div
                  key={cardId}
                  layoutId={cardId}
                  onClick={() => handleOpenDetail(item)}
                  className="border border-line dark:border-console-line bg-paper dark:bg-console-panel p-4 flex flex-col justify-between cursor-pointer hover:border-ink dark:hover:border-console-text transition-colors rounded-[2px] space-y-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-ink dark:text-console-text group-hover:text-accent transition-colors">
                        {item.assetId || plant.name}
                      </span>
                      <Badge variant={isHardware ? (item.confidence > 0.75 ? 'critical' : 'high') : 'info'}>
                        {item.confidenceLabel.toUpperCase()} ({Math.round(item.confidence * 100)}%)
                      </Badge>
                    </div>

                    <h4 className="font-sans text-sm font-medium text-ink dark:text-console-text">
                      {item.mode.replace(/_/g, ' ').toUpperCase()}
                    </h4>

                    <p className="font-sans text-xs text-ink-2 dark:text-console-text/70 line-clamp-2">
                      {matchingTicket?.text || `Identified through hybrid rule fingerprinting (${(item.ruleScore * 100).toFixed(0)}%) and ML probability model.`}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-line/60 dark:border-console-line/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-[10px] text-ink-2 dark:text-console-text/50 block">EST. REVENUE LOSS</span>
                      <span className="font-mono font-medium text-ink dark:text-console-text tabular-nums">
                        {formatCurrency(matchingTicket?.lostRevenue || 1480)}
                      </span>
                    </div>

                    <span className="label text-[10px] text-accent group-hover:underline">
                      INSPECT →
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Slide-Over Detail Drawer ─────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedIssue?.modeName || selectedIssue?.mode?.replace(/_/g, ' ').toUpperCase() || 'Anomaly Details'}
      >
        {selectedIssue && (
          <div className="space-y-6 text-xs">
            {/* Asset and Status Header */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="label text-accent">{plant.name}</span>
                <span className="label text-line">·</span>
                <span className="font-mono text-xs font-semibold text-ink dark:text-console-text">
                  {selectedIssue.assetId}
                </span>
              </div>
              <h3 className="font-display text-xl text-ink dark:text-console-text font-normal">
                {selectedIssue.modeName || selectedIssue.mode?.replace(/_/g, ' ')}
              </h3>
            </div>

            {/* Diagnostic Sentence */}
            <div className="p-3 border border-line dark:border-console-line bg-paper-2 dark:bg-console-bg font-sans text-ink dark:text-console-text leading-relaxed rounded-[2px]">
              {selectedIssue.text || 'Diagnostic fusion verified physical condition across consecutive stable intervals.'}
            </div>

            {/* Financial and Priority Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 border border-line dark:border-console-line bg-paper dark:bg-console-panel">
                <span className="label text-[10px] block mb-1">REVENUE AT RISK</span>
                <span className="font-mono text-sm font-semibold text-ink dark:text-console-text">
                  {formatCurrency(selectedIssue.lostRevenue || 1480)}
                </span>
              </div>

              <div className="p-3 border border-line dark:border-console-line bg-paper dark:bg-console-panel">
                <span className="label text-[10px] block mb-1">PRIORITY SLA</span>
                <Badge variant={selectedIssue.priority === 'P1' ? 'critical' : 'high'}>
                  {selectedIssue.priority || 'P2'} · {selectedIssue.priority === 'P1' ? '24h' : '72h'}
                </Badge>
              </div>
            </div>

            {/* Technician Checklist */}
            {selectedIssue.checklist && (
              <div className="space-y-2">
                <span className="label text-ink dark:text-console-text block">
                  FIELD TECHNICIAN CHECKLIST
                </span>
                <ul className="space-y-1.5 font-sans text-ink-2 dark:text-console-text/80">
                  {selectedIssue.checklist.map((step, sIdx) => (
                    <li key={sIdx} className="flex items-start gap-2">
                      <span className="font-mono text-[10px] text-accent mt-0.5">[{sIdx + 1}]</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Safety Note */}
            {selectedIssue.safetyNote && (
              <div className="p-3 border border-fault/30 bg-fault/10 text-fault rounded-[2px] space-y-1">
                <span className="label text-[10px] font-bold block text-fault">SAFETY NOTICE</span>
                <p className="font-sans text-[11px] leading-relaxed">
                  {selectedIssue.safetyNote}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-4 border-t border-line dark:border-console-line flex items-center justify-between gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setDrawerOpen(false)
                  navigate('/app/work-orders')
                }}
              >
                Dispatch Work Order
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDrawerOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
