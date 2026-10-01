import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePlantStore } from '../store/usePlantStore.js'
import { useWorkOrderStore } from '../store/useWorkOrderStore.js'
import { useSettingsStore } from '../store/useSettingsStore.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import { useToast, Badge, Button, Card, Drawer } from '@/components/ui'
import { cn } from '../lib/cn.js'

// Deterministic ML signed contributions for failure modes
const ML_CONTRIBUTIONS = {
  thermal_derating: [
    { name: 'Heatsink Temp > 75°C Persistence', value: 0.38, positive: true },
    { name: 'Midday Power Plateau Ratio (P/P0)', value: 0.31, positive: true },
    { name: 'Ambient Temp & High POA Interaction', value: 0.19, positive: true },
    { name: 'Fleet Peer Discrepancy Index', value: 0.14, positive: true },
    { name: 'Low Variational Index (Stable Sample)', value: -0.06, positive: false },
  ],
  soiling: [
    { name: 'Daily PR Negative Slope (-0.45%/d)', value: 0.42, positive: true },
    { name: 'Fleet-Wide Uniformity Metric', value: 0.28, positive: true },
    { name: 'Days Elapsed Since Last Rain/Wash', value: 0.21, positive: true },
    { name: 'Clear Sky Fit Residual Trend', value: 0.12, positive: true },
    { name: 'Sub-array Current Discrepancy', value: -0.08, positive: false },
  ],
  shading: [
    { name: 'Diurnal Step Profile Recurrence', value: 0.44, positive: true },
    { name: 'Low Sun Elevation (< 25°) Correlation', value: 0.33, positive: true },
    { name: 'Sub-array East-West Current Delta', value: 0.22, positive: true },
    { name: 'Clear-Sky Period Persistence', value: 0.15, positive: true },
    { name: 'Midday Irradiance Variance', value: -0.09, positive: false },
  ],
  string_fault: [
    { name: 'SCB Current Outlier Z-Score (> 4.2)', value: 0.49, positive: true },
    { name: 'Zero-Current Channel Persistence', value: 0.35, positive: true },
    { name: 'Sub-array Imp Divergence Ratio', value: 0.26, positive: true },
    { name: 'High POA Stability (> 600 W/m²)', value: 0.14, positive: true },
    { name: 'Ambient Temperature Drift', value: -0.05, positive: false },
  ],
  curtailment: [
    { name: 'Uniform Fleet Export Cap Setpoint', value: 0.51, positive: true },
    { name: 'Simultaneous Inverter Saturation', value: 0.36, positive: true },
    { name: 'Grid Frequency / Setpoint Gap', value: 0.24, positive: true },
    { name: 'Zero Heatsink Thermal Overheat', value: -0.18, positive: false },
    { name: 'Healthy Fleet PR at Part Load', value: -0.12, positive: false },
  ],
  sensor_drift: [
    { name: 'Fleet Implied Irradiance Divergence', value: 0.47, positive: true },
    { name: 'Healthy Inverter Agreement CV (< 0.03)', value: 0.34, positive: true },
    { name: 'Multi-Day Sustained Offset Ratio', value: 0.29, positive: true },
    { name: 'Clear-Sky Physics Digital Twin Error', value: 0.22, positive: true },
    { name: 'Inverter Hardware Diagnostic State', value: -0.11, positive: false },
  ],
}

// Rule Evidence explanations
const RULE_EVIDENCE = {
  thermal_derating: [
    'Inverter heatsink temperature sustained > 78.5 °C for 42 consecutive minutes during peak noon window.',
    'AC active generation clamped at exactly 850 kWac while digital twin expected DC capacity exceeded 1,020 kW.',
    'Fleet peer inverters (INV-01, INV-02) operated at 1,180 kWac nominal without triggering thermal protection.',
    'Plateau onset strictly correlates with ambient temperature rising above 39.0 °C and blower fan RPM alert.',
  ],
  soiling: [
    'Fleet daily PR decreased monotonically by -0.42 % per day over 7 consecutive clear sky monitoring periods.',
    'Uniform yield gap observed symmetrically across all 8 central inverters with cross-inverter variance < 1.2 %.',
    'Soiling derating integral reaches 4.8 % overall generation loss; economic payback threshold for robotic wash reached.',
    'Transients excluded from slope estimation; fit confidence R² = 0.96.',
  ],
  shading: [
    'Repeatable localized generation depression occurring strictly between 07:30 and 09:15 IST under low solar elevation.',
    'Loss profile mirrors geometric shadow angle of adjacent perimeter transmission tower and boundary tree line.',
    'Clear-sky residual signature reproduces identically across all 7 monitored days with < 1.5 % deviation.',
    'String current mismatch isolated to bottom module tiers on Combiner Box SCB-01.',
  ],
  string_fault: [
    'Combiner Box SCB-02 string 07 measured current dropped to 0.0 A while parallel strings delivered 12.8 A nominal.',
    'Fault condition persisted for 100% of daylight samples with POA > 200 W/m² (total 1,420 minutes).',
    'Open-circuit condition isolates to a blown 15A gPV inline fuse or disconnected DC branch connector.',
    'DC voltage on string matches array open circuit potential Voc = 48.2 V, verifying string continuity is intact.',
  ],
  curtailment: [
    'Total plant export pinned at 7,500 kWac flat ceiling from 12:00 to 14:15 IST per SLDC dispatch order.',
    'All 8 central inverters simultaneously capped output proportionally without individual fault alerts.',
    'Zero internal equipment degradation; loss categorized strictly as Grid Curtailment (Non-equipment ticket).',
    'Full unconstrained generation restored instantly upon release of setpoint limit.',
  ],
  sensor_drift: [
    'Field pyranometer POA reads 8.1 % higher than fleet-implied irradiance back-calculated from unclipped inverters.',
    'Inverters agree with each other with coefficient of variation CV = 0.021, proving plant generation is normal.',
    'Pyranometer discrepancy persists identically across morning and afternoon ramps, ruling out physical shading.',
    'Auto-calibration factor of 0.925 applied to prevent false soiling or inverter underperformance ticketing.',
  ],
}

// Ruled Out alternative failure modes
const RULED_OUT_MODES = {
  thermal_derating: [
    { mode: 'Cloud Transient', score: 0.04, reason: 'Loss persists on stable clear-sky samples; Stein Variability Index VI = 1.08 < 1.30.' },
    { mode: 'Uniform Soiling', score: 0.12, reason: 'Loss is localized to INV-04; peer inverters maintain nominal PR > 81.5%.' },
    { mode: 'Grid Curtailment', score: 0.07, reason: 'No dispatch limit active; adjacent inverters exporting at full unclipped capacity.' },
    { mode: 'Pyranometer Drift', score: 0.02, reason: 'WMS sensor agrees with clear-sky digital twin model within ±0.7%.' },
  ],
  soiling: [
    { mode: 'Inverter Derating', score: 0.05, reason: 'Heatsink temperatures remain < 64 °C; zero power plateauing detected.' },
    { mode: 'String Disconnect', score: 0.08, reason: 'String current distribution remains balanced with SCB variance < 2.5%.' },
    { mode: 'Cloud Transient', score: 0.03, reason: 'Degradation trend calculated strictly from clear-sky filtered diurnal integrals.' },
    { mode: 'Grid Curtailment', score: 0.02, reason: 'No flat setpoint plateau; loss is proportional across all irradiance levels.' },
  ],
  shading: [
    { mode: 'Uniform Soiling', score: 0.10, reason: 'Loss is strictly time-of-day dependent and recovers fully by midday sun elevation.' },
    { mode: 'Inverter Fault', score: 0.04, reason: 'Inverter internal telemetry and MPPT tracking indicate normal operation.' },
    { mode: 'Cloud Transient', score: 0.06, reason: 'Signature reproduces at exact sun azimuth and elevation across 7 consecutive days.' },
  ],
  string_fault: [
    { mode: 'Inverter Thermal Derating', score: 0.02, reason: 'Heatsink temperature is optimal (56 °C); loss is isolated to single string.' },
    { mode: 'Uniform Soiling', score: 0.06, reason: '47 out of 48 string channels operate at 100% nominal current.' },
    { mode: 'Cloud Transient', score: 0.01, reason: 'Current drop is 100% sustained and does not recover during peak clear sky.' },
  ],
  curtailment: [
    { mode: 'Inverter Thermal Derating', score: 0.04, reason: 'Heatsink temperatures < 62 °C; all inverters throttled simultaneously.' },
    { mode: 'String Open Circuit', score: 0.02, reason: 'All combiner box string currents remain identical and balanced.' },
    { mode: 'Uniform Soiling', score: 0.05, reason: 'Power drop matches external SLDC grid export limit schedule.' },
  ],
  sensor_drift: [
    { mode: 'Uniform Soiling', score: 0.09, reason: 'Inverters produce full expected kWh per square meter of actual sun.' },
    { mode: 'Inverter Hardware Fault', score: 0.03, reason: 'All inverters agree with high mutual consistency (CV = 0.021).' },
    { mode: 'Cloud Transient', score: 0.04, reason: 'Drift offset is constant and verified across 7 clear midday windows.' },
  ],
}

export default function Diagnosis() {
  const { diagId } = useParams()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const pushToast = useToast()

  const { portfolio, selectedPlantId, diagnoses } = usePlantStore()
  const { tickets, createFromDiagnosis } = useWorkOrderStore()
  const { currency } = useSettingsStore()

  const [activeTab, setActiveTab] = useState('signal') // 'signal' | 'why' | 'ruled_out'
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [typedChars, setTypedChars] = useState(reduced ? 9999 : 0)

  // Identify active plant and matching diagnosis/anomaly
  const activePlant = useMemo(() => {
    return portfolio.find((p) => p.id === selectedPlantId) || portfolio[0]
  }, [portfolio, selectedPlantId])

  const diagnosis = diagnoses[selectedPlantId]

  // Extract or synthesize anomaly information based on diagId
  const anomaly = useMemo(() => {
    // Normalise mode
    let targetMode = 'thermal_derating'
    if (diagId) {
      if (diagId.includes('soiling')) targetMode = 'soiling'
      else if (diagId.includes('derating') || diagId.includes('thermal')) targetMode = 'thermal_derating'
      else if (diagId.includes('string')) targetMode = 'string_fault'
      else if (diagId.includes('curtailment')) targetMode = 'curtailment'
      else if (diagId.includes('drift') || diagId.includes('sensor')) targetMode = 'sensor_drift'
      else if (diagId.includes('shading')) targetMode = 'shading'
    }

    // Try finding in tickets or anomalies
    const fromTickets = tickets.find((t) => t.id === diagId || t.mode === targetMode)
    const fromAnomalies = diagnosis?.anomalies?.find((a) => a.mode === targetMode || a.id === diagId)

    const baseMode = fromTickets?.mode || fromAnomalies?.mode || targetMode

    // Prescription text
    let prescriptionText = ''
    let assetId = 'INV-04'
    let lostRevenue = 8946
    let lostKWh = 2840
    let priority = 'P1'

    if (baseMode === 'thermal_derating') {
      assetId = 'INV-04'
      lostRevenue = 8946
      lostKWh = 2840
      priority = 'P1'
      prescriptionText =
        'Generation is 18.2 % below expected. Likely causes: Inverter Thermal Derating on INV-04. Recommended action: Inspect blower fan #2 and clean intake air filters.'
    } else if (baseMode === 'soiling') {
      assetId = 'Fleet Array (All 8 Inverters)'
      lostRevenue = 14820
      lostKWh = 4700
      priority = 'P2'
      prescriptionText =
        'Generation is 6.8 % below expected. Likely causes: Uniform desert soiling with -0.42 %/day PR slope. Recommended action: Dispatch robotic wet cleaning for Block C rows 1-24.'
    } else if (baseMode === 'string_fault') {
      assetId = 'INV-03 / SCB-02'
      lostRevenue = 4120
      lostKWh = 1310
      priority = 'P1'
      prescriptionText =
        'Generation is 4.3 % below expected. Likely causes: String Open Circuit on SCB-02 string 07 (0.0 A vs 12.8 A expected). Recommended action: Replace blown 15A 1000V gPV fuse.'
    } else if (baseMode === 'shading') {
      assetId = 'INV-01 / SCB-01'
      lostRevenue = 2940
      lostKWh = 930
      priority = 'P3'
      prescriptionText =
        'Generation is 2.9 % below expected. Likely causes: Fixed geometric partial shading from transmission corridor. Recommended action: Confirm module bypass diode health; no hardware defect.'
    } else if (baseMode === 'curtailment') {
      assetId = 'Grid Interconnect (Substation 33kV)'
      lostRevenue = 12400
      lostKWh = 3940
      priority = 'P2'
      prescriptionText =
        'Generation is 14.5 % below expected. Likely causes: SLDC Grid Export Curtailment setpoint capped at 7.5 MWac. Recommended action: Log curtailment event for PPA deeming compensation.'
    } else {
      assetId = 'WMS Secondary Pyranometer #1'
      lostRevenue = 0
      lostKWh = 0
      priority = 'P3'
      prescriptionText =
        'Generation is 0.0 % below expected. Likely causes: Pyranometer Calibration Drift of +8.1 % vs fleet baseline. Recommended action: Recalibrate secondary WMS thermopile pyranometer.'
    }

    return {
      mode: baseMode,
      assetId: fromTickets?.assetId || assetId,
      priority: fromTickets?.priority || priority,
      lostRevenue: fromTickets?.lostRevenue || lostRevenue,
      lostKWh: fromTickets?.lostKWh || lostKWh,
      projected30DayRevenue: (fromTickets?.lostRevenue || lostRevenue) * 30,
      confidence: 0.88,
      confidenceLabel: 'High',
      imputedPct: 0.4,
      transientExcludedPct: 3.2,
      prescriptionText: fromTickets?.recommendation || prescriptionText,
      tools: fromTickets?.tools || [
        'CAT IV 1000V Multimeter',
        'Thermal IR Camera',
        'Cabinet LOTO Key',
        'Torque Wrench 24mm',
      ],
      safetyNote:
        fromTickets?.safety ||
        'Strict Lockout/Tagout (LOTO) 1000V DC isolation required prior to cabinet access. Arc flash PPE Category 2 required.',
      checklist: fromTickets?.checklist || [
        'Verify DC isolator disconnect switch is open and tagged',
        'Check intake filter mesh for sand accumulation and obstruction',
        'Inspect blower fan #2 auxiliary contactor and thermistor resistance',
        'Log ambient temperature and clean heatsink heat pipe fins',
      ],
    }
  }, [diagId, tickets, diagnosis])

  // Redirect to portfolio if diagId is not provided
  useEffect(() => {
    if (!diagId) {
      navigate('/app', { replace: true })
    }
  }, [diagId, navigate])

  // Typewriter effect for prescription
  useEffect(() => {
    if (reduced) {
      setTypedChars(anomaly.prescriptionText.length)
      return
    }

    setTypedChars(0)
    let current = 0
    const textLength = anomaly.prescriptionText.length
    const interval = setInterval(() => {
      current++
      setTypedChars(current)
      if (current >= textLength) clearInterval(interval)
    }, 20)

    return () => clearInterval(interval)
  }, [anomaly.prescriptionText, reduced])

  // Helper to format typed text with Fraunces 28px and numbers in mono amber
  const renderedPrescription = useMemo(() => {
    const visibleText = anomaly.prescriptionText.slice(0, typedChars)
    // Regex splits by numbers/percentages so digits become mono amber
    const parts = visibleText.split(/(\d+(?:\.\d+)?(?:\s*%|\s*kWac|\s*kW|\s*MWac)?)/g)

    return parts.map((part, idx) => {
      if (/^\d+(?:\.\d+)?(?:\s*%|\s*kWac|\s*kW|\s*MWac)?$/.test(part)) {
        return (
          <span key={idx} className="font-mono text-accent font-medium tabular-nums">
            {part}
          </span>
        )
      }
      return <span key={idx}>{part}</span>
    })
  }, [anomaly.prescriptionText, typedChars])

  // Create work order action
  const handleConfirmWorkOrder = () => {
    const newOrder = {
      id: `WO-${Date.now().toString().slice(-4)}`,
      assetId: anomaly.assetId,
      mode: anomaly.mode,
      priority: anomaly.priority,
      lostKWh: anomaly.lostKWh,
      lostRevenue: anomaly.lostRevenue,
      projected30DayRevenueLoss: anomaly.projected30DayRevenue,
      actionDirective: anomaly.prescriptionText,
      recommendation: anomaly.prescriptionText,
      tools: anomaly.tools,
      safety: anomaly.safetyNote,
      checklist: anomaly.checklist,
    }

    createFromDiagnosis(selectedPlantId, [newOrder])
    setDrawerOpen(false)
    pushToast(`Work order ${newOrder.id} created and queued for dispatch.`)
  }

  const handleExportReport = () => {
    window.print()
  }

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* Printable Report Stylesheet Header (hidden in screen, visible in print) */}
      <div className="hidden print:block mb-6 border-b border-ink pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">KIRAN RCA · FIELD ENGINEERING REPORT</h1>
            <p className="font-mono text-xs text-ink-2 mt-1">
              Asset: {activePlant.name} · {anomaly.assetId} · Mode: {anomaly.mode.toUpperCase()}
            </p>
          </div>
          <div className="text-right font-mono text-xs text-ink-2">
            <div>Date: {new Date().toLocaleDateString('en-GB')}</div>
            <div>Ref: {diagId || 'DIAG-REF-01'}</div>
          </div>
        </div>
      </div>

      {/* Screen Navigation Breadcrumbs */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/app/plant/${selectedPlantId}`)}
            className="text-xs font-mono"
          >
            ← Back to plant
          </Button>
          <div className="flex items-center gap-2 font-mono text-xs text-ink-2">
            <Link to="/app" className="hover:text-ink">
              Portfolio
            </Link>
            <span>/</span>
            <Link to={`/app/plant/${selectedPlantId}`} className="hover:text-ink">
              {activePlant.name}
            </Link>
            <span>/</span>
            <span className="text-ink font-medium uppercase">{anomaly.mode.replace(/_/g, ' ')}</span>
          </div>
        </div>

        <Badge variant={anomaly.priority === 'P1' ? 'critical' : 'medium'}>
          {anomaly.priority} · SLA {anomaly.priority === 'P1' ? '24 Hours' : '72 Hours'}
        </Badge>
      </div>

      {/* Two Column Layout on Desktop, Stacked on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column (7 cols on lg) ─────────────────────────── */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Prescription in Fraunces 28px with numbers in mono amber */}
          <div className="border border-line bg-paper p-5 sm:p-6 space-y-2">
            <span className="label text-accent text-[10px] block">PRESCRIPTIVE DIRECTIVE</span>
            <h2 className="font-display text-2xl sm:text-[28px] text-ink leading-snug font-normal">
              {renderedPrescription}
              {typedChars < anomaly.prescriptionText.length && (
                <span className="inline-block w-2 h-5 bg-accent ml-1 animate-pulse" />
              )}
            </h2>
          </div>

          {/* 2. Evidence Tabs */}
          <div className="border border-line bg-paper">
            {/* Tab Bar */}
            <div className="flex border-b border-line">
              <button
                onClick={() => setActiveTab('signal')}
                className={cn(
                  'px-4 py-2.5 label text-[11px] transition-colors',
                  activeTab === 'signal'
                    ? 'border-b-2 border-accent text-ink font-medium bg-paper-2/40'
                    : 'text-ink-2 hover:text-ink'
                )}
              >
                1. Signal Evidence
              </button>
              <button
                onClick={() => setActiveTab('why')}
                className={cn(
                  'px-4 py-2.5 label text-[11px] transition-colors',
                  activeTab === 'why'
                    ? 'border-b-2 border-accent text-ink font-medium bg-paper-2/40'
                    : 'text-ink-2 hover:text-ink'
                )}
              >
                2. Why Engine Thinks This
              </button>
              <button
                onClick={() => setActiveTab('ruled_out')}
                className={cn(
                  'px-4 py-2.5 label text-[11px] transition-colors',
                  activeTab === 'ruled_out'
                    ? 'border-b-2 border-accent text-ink font-medium bg-paper-2/40'
                    : 'text-ink-2 hover:text-ink'
                )}
              >
                3. Ruled Out Modes
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-4 sm:p-5">
              {/* Tab 1: Mode-Specific Signal Chart */}
              {activeTab === 'signal' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="label text-ink font-medium text-xs">
                      Physical Telemetry Signature ({anomaly.mode.replace(/_/g, ' ').toUpperCase()})
                    </span>
                    <span className="font-mono text-[10px] text-ink-2">5-Min Resolution · SCADA Feed</span>
                  </div>

                  <ModeSpecificSignalChart mode={anomaly.mode} />
                </div>
              )}

              {/* Tab 2: Why the Engine Thinks This (Rule Evidence + Signed ML ContributionBars) */}
              {activeTab === 'why' && (
                <div className="space-y-6">
                  {/* Rule Evidence Bullets */}
                  <div className="space-y-2.5">
                    <span className="label text-ink-2 text-[10px] block">RULE FINGERPRINT EVIDENCE (45% WEIGHT)</span>
                    <div className="space-y-2">
                      {(RULE_EVIDENCE[anomaly.mode] || RULE_EVIDENCE.thermal_derating).map((rule, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs text-ink leading-relaxed">
                          <span className="font-mono text-accent text-[11px] font-bold mt-0.5">[{idx + 1}]</span>
                          <span className="font-sans">{rule}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top 5 Signed ML Feature Contributions */}
                  <div className="space-y-3 border-t border-line pt-4">
                    <div className="flex items-center justify-between">
                      <span className="label text-ink-2 text-[10px] block">
                        SIGNED ML FEATURE CONTRIBUTIONS (55% WEIGHT)
                      </span>
                      <span className="font-mono text-[10px] text-ink-2">Random Forest Local SHAP</span>
                    </div>

                    <div className="space-y-2.5 font-mono text-xs">
                      {(ML_CONTRIBUTIONS[anomaly.mode] || ML_CONTRIBUTIONS.thermal_derating).map((item, idx) => {
                        const barPct = Math.round(Math.abs(item.value) * 100)
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-ink font-sans">{item.name}</span>
                              <span className={cn('font-mono font-medium', item.positive ? 'text-accent' : 'text-ink-2')}>
                                {item.positive ? '+' : ''}
                                {item.value.toFixed(2)}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-paper-2 border border-line/60 overflow-hidden flex">
                              <div
                                className={cn('h-full transition-all duration-300', item.positive ? 'bg-accent' : 'bg-ink-2')}
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Ruled Out Modes */}
              {activeTab === 'ruled_out' && (
                <div className="space-y-3">
                  <span className="label text-ink-2 text-[10px] block">
                    ALTERNATIVE HYPOTHESES REJECTED BY CRUCIBLE
                  </span>

                  <div className="space-y-2">
                    {(RULED_OUT_MODES[anomaly.mode] || RULED_OUT_MODES.thermal_derating).map((alt, idx) => (
                      <div key={idx} className="border border-line p-3 bg-paper-2/40 space-y-1">
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="font-medium text-ink uppercase">{alt.mode}</span>
                          <span className="text-ink-2 text-[11px]">Engine Score: {(alt.score * 100).toFixed(0)}% (Sub-threshold)</span>
                        </div>
                        <p className="font-sans text-xs text-ink-2 leading-relaxed">
                          <span className="text-fault font-mono font-medium text-[11px]">Ruled out: </span>
                          {alt.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Data Quality Note */}
          <div className="border border-line bg-paper-2 p-4 flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-ok mt-1.5 shrink-0" />
            <div className="space-y-1">
              <span className="label text-ink text-[10px]">DATA INTEGRITY &amp; CONFIDENCE PENALTY AUDIT</span>
              <p className="font-sans text-xs text-ink-2 leading-relaxed">
                SCADA completeness: <span className="font-mono text-ink font-medium">99.6%</span>. Imputed gaps:{' '}
                <span className="font-mono text-ink font-medium">{anomaly.imputedPct}%</span> (forward-filled &le;15m). Transient
                samples excluded: <span className="font-mono text-ink font-medium">{anomaly.transientExcludedPct}%</span>. Confidence
                penalized by -4.2% for non-stationary irradiance. Net diagnostic confidence remains{' '}
                <span className="font-mono text-ok font-medium">High ({(anomaly.confidence * 100).toFixed(1)}%)</span>.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right Column (Sticky 5 cols on lg) ──────────────────── */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
          {/* Asset Card */}
          <div className="border border-line bg-paper p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="label text-ink font-medium">Monitored Asset</span>
              <span className="font-mono text-xs font-bold text-accent">{anomaly.assetId}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div>
                <span className="text-ink-2 text-[10px] block">Location</span>
                <span className="text-ink">{activePlant.name}</span>
              </div>
              <div>
                <span className="text-ink-2 text-[10px] block">Position</span>
                <span className="text-ink">Block C · Pad 02</span>
              </div>
              <div>
                <span className="text-ink-2 text-[10px] block">Hardware Model</span>
                <span className="text-ink truncate">SMA Central 1250-CP</span>
              </div>
              <div>
                <span className="text-ink-2 text-[10px] block">Commissioned</span>
                <span className="text-ink">14 Nov 2021</span>
              </div>
            </div>
          </div>

          {/* Impact Card */}
          <div className="border border-line bg-paper p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="label text-ink font-medium">Quantified Financial Impact</span>
              <Badge variant={anomaly.priority === 'P1' ? 'critical' : 'medium'}>
                {anomaly.priority} Priority
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="border border-line p-2.5 bg-paper-2">
                <span className="label text-ink-2 text-[10px] block">Loss (Window)</span>
                <div className="text-base font-medium text-fault mt-0.5">
                  {currency}&nbsp;{anomaly.lostRevenue.toLocaleString()}
                </div>
                <div className="text-[11px] text-ink-2 mt-0.5">{anomaly.lostKWh.toLocaleString()} kWh lost</div>
              </div>

              <div className="border border-line p-2.5 bg-paper-2">
                <span className="label text-ink-2 text-[10px] block">30-Day Projected</span>
                <div className="text-base font-medium text-ink mt-0.5">
                  {currency}&nbsp;{anomaly.projected30DayRevenue.toLocaleString()}
                </div>
                <div className="text-[11px] text-ink-2 mt-0.5">If unaddressed</div>
              </div>
            </div>

            {/* Thin Confidence Bar */}
            <div className="space-y-1.5 pt-2 border-t border-line">
              <div className="flex justify-between font-mono text-[11px]">
                <span className="label text-ink-2 text-[10px]">DIAGNOSTIC CONFIDENCE</span>
                <span className="text-ok font-medium">HIGH ({Math.round(anomaly.confidence * 100)}%)</span>
              </div>
              <div className="w-full h-1 bg-line overflow-hidden">
                <div className="h-full bg-ok" style={{ width: `${anomaly.confidence * 100}%` }} />
              </div>
              <div className="flex justify-between font-mono text-[9px] text-ink-2">
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
            </div>
          </div>

          {/* Field Checklist & Safety Card */}
          <div className="border border-line bg-paper p-4 space-y-3">
            <span className="label text-ink font-medium block">Field Technician Protocol</span>

            {/* Tools required */}
            <div className="space-y-1">
              <span className="label text-ink-2 text-[10px]">Required Equipment &amp; PPE</span>
              <div className="flex flex-wrap gap-1">
                {anomaly.tools.map((t, idx) => (
                  <span key={idx} className="font-mono text-[10px] px-1.5 py-0.5 bg-paper-2 border border-line text-ink">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Safety Note */}
            <div className="border-l-2 border-l-fault bg-fault/10 p-2.5">
              <span className="label text-fault text-[10px] block">SAFETY CRITICAL</span>
              <p className="font-sans text-[11px] text-ink leading-tight mt-0.5">{anomaly.safetyNote}</p>
            </div>

            {/* Checklist items */}
            <div className="space-y-1.5 pt-1">
              <span className="label text-ink-2 text-[10px]">Step-by-Step Verification</span>
              <div className="space-y-1">
                {anomaly.checklist.map((item, idx) => (
                  <label key={idx} className="flex items-start gap-2 text-xs text-ink cursor-pointer">
                    <input type="checkbox" className="mt-0.5 accent-accent" />
                    <span className="font-sans leading-tight">{item}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-line flex flex-col sm:flex-row gap-2">
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                onClick={() => setDrawerOpen(true)}
              >
                Create Work Order
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={handleExportReport}
              >
                Export Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Prefilled Create Work Order Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Dispatch CMMS Work Order"
        width="w-[480px]"
      >
        <div className="space-y-4 text-xs font-sans">
          <div className="border border-line p-3 bg-paper-2 space-y-1">
            <div className="label text-accent text-[10px]">AUTO-GENERATED PRESCRIPTION</div>
            <p className="text-ink leading-relaxed font-sans">{anomaly.prescriptionText}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="border border-line p-2">
              <span className="text-ink-2 text-[10px] block">Target Asset</span>
              <span className="text-ink font-medium">{anomaly.assetId}</span>
            </div>
            <div className="border border-line p-2">
              <span className="text-ink-2 text-[10px] block">Priority Assignment</span>
              <span className="text-fault font-medium">{anomaly.priority} - Immediate Dispatch</span>
            </div>
          </div>

          <div className="space-y-1 font-mono">
            <span className="label text-ink-2 text-[10px]">Assignee Lead</span>
            <select className="w-full bg-paper border border-line p-2 text-xs text-ink">
              <option>R. Meena (HV Electrical Lead)</option>
              <option>S. Choudhary (Array Field Technician)</option>
              <option>A. Rao (Inverter Specialist)</option>
            </select>
          </div>

          <div className="space-y-1 font-mono">
            <span className="label text-ink-2 text-[10px]">Estimated Repair Window</span>
            <input
              type="text"
              defaultValue="2.5 Hours (Off-peak or isolation)"
              className="w-full bg-paper border border-line p-2 text-xs text-ink"
            />
          </div>

          <div className="pt-3 border-t border-line flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleConfirmWorkOrder}>
              Confirm &amp; Push to Queue
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}

/**
 * Renders mode-specific signal charts for all 6 failure modes.
 */
function ModeSpecificSignalChart({ mode }) {
  // 1. Derating: Dual axis AC plateau vs Heatsink temp
  if (mode === 'thermal_derating') {
    return (
      <div className="space-y-2">
        <div className="h-52 w-full border border-line bg-paper-2 p-2">
          <svg viewBox="0 0 540 180" className="w-full h-full" preserveAspectRatio="none">
            {/* Grid */}
            {[30, 80, 130, 160].map((y, idx) => (
              <line key={idx} x1="40" y1={y} x2="500" y2={y} stroke="#D6D1C4" strokeWidth="1" strokeDasharray="2 4" />
            ))}
            {/* Y axis labels */}
            <text x="32" y="34" textAnchor="end" className="text-[10px] font-mono fill-ink-2">1250 kW</text>
            <text x="32" y="84" textAnchor="end" className="text-[10px] font-mono fill-ink-2">850 kW</text>
            <text x="32" y="164" textAnchor="end" className="text-[10px] font-mono fill-ink-2">0</text>

            <text x="508" y="34" textAnchor="start" className="text-[10px] font-mono fill-fault">90 °C</text>
            <text x="508" y="84" textAnchor="start" className="text-[10px] font-mono fill-fault">78 °C (trip)</text>
            <text x="508" y="164" textAnchor="start" className="text-[10px] font-mono fill-fault">35 °C</text>

            {/* Expected AC curve (dashed) */}
            <path
              d="M 45 160 Q 150 160 200 45 Q 270 20 340 45 Q 400 160 495 160"
              fill="none"
              stroke="#4A473D"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            {/* Actual AC curve with flat plateau (amber) */}
            <path
              d="M 45 160 Q 150 160 200 84 L 340 84 Q 400 160 495 160"
              fill="none"
              stroke="#D9790B"
              strokeWidth="2.5"
            />
            {/* Heatsink temperature curve (red) */}
            <path
              d="M 45 150 Q 180 140 210 80 Q 270 35 330 75 Q 420 130 495 150"
              fill="none"
              stroke="#B4441E"
              strokeWidth="2"
            />
            {/* Threshold dashed line */}
            <line x1="45" y1="84" x2="495" y2="84" stroke="#B4441E" strokeWidth="1" strokeDasharray="3 3" />
          </svg>
        </div>
        <div className="flex justify-between font-mono text-[11px] text-ink-2 px-1">
          <div className="flex gap-4">
            <span className="text-accent font-medium">— Actual AC Power (Plateau 850 kW)</span>
            <span className="text-fault font-medium">— Heatsink Temp (&gt;78.5 °C)</span>
            <span>- - Expected AC</span>
          </div>
          <span>Diurnal 06:00 - 18:30</span>
        </div>
      </div>
    )
  }

  // 2. Soiling: Daily PR trend with cleaning markers
  if (mode === 'soiling') {
    return (
      <div className="space-y-2">
        <div className="h-52 w-full border border-line bg-paper-2 p-2">
          <svg viewBox="0 0 540 180" className="w-full h-full" preserveAspectRatio="none">
            {/* Grid */}
            {[30, 75, 120, 160].map((y, idx) => (
              <line key={idx} x1="40" y1={y} x2="500" y2={y} stroke="#D6D1C4" strokeWidth="1" strokeDasharray="2 4" />
            ))}
            <text x="32" y="34" textAnchor="end" className="text-[10px] font-mono fill-ink-2">85 %</text>
            <text x="32" y="79" textAnchor="end" className="text-[10px] font-mono fill-ink-2">80 %</text>
            <text x="32" y="124" textAnchor="end" className="text-[10px] font-mono fill-ink-2">75 %</text>
            <text x="32" y="164" textAnchor="end" className="text-[10px] font-mono fill-ink-2">70 %</text>

            {/* PR daily steps */}
            <path
              d="M 50 40 L 110 52 L 170 65 L 230 78 L 290 92 L 350 106 L 410 120 L 470 134"
              fill="none"
              stroke="#D9790B"
              strokeWidth="2"
            />
            {/* Dots */}
            {[
              [50, 40], [110, 52], [170, 65], [230, 78], [290, 92], [350, 106], [410, 120], [470, 134]
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="3.5" fill="#D9790B" />
            ))}

            {/* Optimal cleaning threshold line */}
            <line x1="50" y1="110" x2="490" y2="110" stroke="#B4441E" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="490" y="106" textAnchor="end" className="text-[10px] font-mono fill-fault">Wash Payback Threshold</text>
          </svg>
        </div>
        <div className="flex justify-between font-mono text-[11px] text-ink-2 px-1">
          <span className="text-accent font-medium">— Daily PR Trend (-0.42 % / day slope)</span>
          <span>7-Day Clear Sky Series</span>
        </div>
      </div>
    )
  }

  // 3. Shading: Overlaid time-of-day loss curves
  if (mode === 'shading') {
    return (
      <div className="space-y-2">
        <div className="h-52 w-full border border-line bg-paper-2 p-2">
          <svg viewBox="0 0 540 180" className="w-full h-full" preserveAspectRatio="none">
            {[30, 80, 130, 160].map((y, idx) => (
              <line key={idx} x1="40" y1={y} x2="500" y2={y} stroke="#D6D1C4" strokeWidth="1" strokeDasharray="2 4" />
            ))}
            <text x="32" y="34" textAnchor="end" className="text-[10px] font-mono fill-ink-2">100 %</text>
            <text x="32" y="84" textAnchor="end" className="text-[10px] font-mono fill-ink-2">50 %</text>
            <text x="32" y="164" textAnchor="end" className="text-[10px] font-mono fill-ink-2">0</text>

            {/* Day 1, 2, 3 overlaid morning shade dips */}
            <path d="M 50 160 Q 90 150 110 120 L 140 120 Q 200 40 300 35 Q 420 40 490 160" fill="none" stroke="#D9790B" strokeWidth="2" />
            <path d="M 50 160 Q 90 150 112 118 L 142 118 Q 200 40 300 35 Q 420 40 490 160" fill="none" stroke="#B98A12" strokeWidth="1.5" strokeOpacity="0.7" />
            <path d="M 50 160 Q 90 150 114 116 L 144 116 Q 200 40 300 35 Q 420 40 490 160" fill="none" stroke="#4A473D" strokeWidth="1" strokeDasharray="2 2" />

            {/* Shading window indicator */}
            <rect x="95" y="25" width="60" height="135" fill="#B4441E" fillOpacity="0.08" />
            <text x="125" y="20" textAnchor="middle" className="text-[9px] font-mono fill-fault">07:30 - 09:15 Dip</text>
          </svg>
        </div>
        <div className="flex justify-between font-mono text-[11px] text-ink-2 px-1">
          <span className="text-accent font-medium">— Recurring Diurnal Shadow Signature (Days 1 to 3)</span>
          <span>Tower Shadow Profile</span>
        </div>
      </div>
    )
  }

  // 4. String Fault: 12-string strip with outlier highlighted
  if (mode === 'string_fault') {
    const stringCurrents = [
      { id: 'S01', val: 12.8 }, { id: 'S02', val: 12.9 }, { id: 'S03', val: 12.7 },
      { id: 'S04', val: 12.8 }, { id: 'S05', val: 12.6 }, { id: 'S06', val: 12.8 },
      { id: 'S07', val: 0.0, fault: true }, { id: 'S08', val: 12.9 }, { id: 'S09', val: 12.7 },
      { id: 'S10', val: 12.8 }, { id: 'S11', val: 12.9 }, { id: 'S12', val: 12.8 },
    ]

    return (
      <div className="space-y-3">
        <div className="border border-line bg-paper-2 p-4">
          <div className="text-xs font-mono text-ink-2 mb-3 flex justify-between">
            <span>Combiner Box SCB-02 String Currents (POA: 840 W/m²)</span>
            <span className="text-fault font-medium">S07 Disconnected (0.0 A)</span>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 items-end h-36 border-b border-line pb-2">
            {stringCurrents.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1 h-full justify-end">
                <div
                  className={cn(
                    'w-full transition-all duration-300',
                    s.fault ? 'bg-fault border border-fault h-1' : 'bg-ink hover:bg-accent'
                  )}
                  style={{ height: s.fault ? '3px' : `${(s.val / 14) * 100}%` }}
                />
                <span className={cn('font-mono text-[9px]', s.fault ? 'text-fault font-bold' : 'text-ink-2')}>
                  {s.id}
                </span>
                <span className={cn('font-mono text-[8px]', s.fault ? 'text-fault font-bold' : 'text-ink')}>
                  {s.val.toFixed(1)}A
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="font-mono text-[11px] text-ink-2 flex justify-between px-1">
          <span>Expected Imp: 12.8 A ± 0.3 A</span>
          <span className="text-fault font-medium">Outlier Z-score: 4.8</span>
        </div>
      </div>
    )
  }

  // 5. Curtailment: Fleet generation vs setpoint
  if (mode === 'curtailment') {
    return (
      <div className="space-y-2">
        <div className="h-52 w-full border border-line bg-paper-2 p-2">
          <svg viewBox="0 0 540 180" className="w-full h-full" preserveAspectRatio="none">
            {[30, 80, 130, 160].map((y, idx) => (
              <line key={idx} x1="40" y1={y} x2="500" y2={y} stroke="#D6D1C4" strokeWidth="1" strokeDasharray="2 4" />
            ))}
            <text x="32" y="34" textAnchor="end" className="text-[10px] font-mono fill-ink-2">10 MW</text>
            <text x="32" y="84" textAnchor="end" className="text-[10px] font-mono fill-ink-2">7.5 MW</text>
            <text x="32" y="164" textAnchor="end" className="text-[10px] font-mono fill-ink-2">0</text>

            {/* Unconstrained potential generation (dashed) */}
            <path d="M 45 160 Q 150 160 200 40 Q 270 20 340 40 Q 400 160 495 160" fill="none" stroke="#4A473D" strokeWidth="1.5" strokeDasharray="4 3" />
            {/* Actual generation clipped flat at 7.5MW setpoint */}
            <path d="M 45 160 Q 150 160 200 84 L 340 84 Q 400 160 495 160" fill="none" stroke="#D9790B" strokeWidth="2.5" />
            {/* Setpoint red limit line */}
            <line x1="45" y1="84" x2="495" y2="84" stroke="#B4441E" strokeWidth="1.5" strokeDasharray="4 4" />
          </svg>
        </div>
        <div className="flex justify-between font-mono text-[11px] text-ink-2 px-1">
          <span className="text-accent font-medium">— Fleet Output Pinned to 7.5 MW Setpoint</span>
          <span>12:00 - 14:15 Grid Curtailment</span>
        </div>
      </div>
    )
  }

  // 6. Sensor Drift: Pyranometer vs Fleet-Implied
  return (
    <div className="space-y-2">
      <div className="h-52 w-full border border-line bg-paper-2 p-2">
        <svg viewBox="0 0 540 180" className="w-full h-full" preserveAspectRatio="none">
          {[30, 80, 130, 160].map((y, idx) => (
            <line key={idx} x1="40" y1={y} x2="500" y2={y} stroke="#D6D1C4" strokeWidth="1" strokeDasharray="2 4" />
          ))}
          <text x="32" y="34" textAnchor="end" className="text-[10px] font-mono fill-ink-2">1000 W/m²</text>
          <text x="32" y="84" textAnchor="end" className="text-[10px] font-mono fill-ink-2">500</text>
          <text x="32" y="164" textAnchor="end" className="text-[10px] font-mono fill-ink-2">0</text>

          {/* Observed POA (+8.1% higher) */}
          <path d="M 45 160 Q 160 160 270 30 Q 380 160 495 160" fill="none" stroke="#D9790B" strokeWidth="2" />
          {/* Fleet implied POA */}
          <path d="M 45 160 Q 160 160 270 42 Q 380 160 495 160" fill="none" stroke="#4A473D" strokeWidth="1.75" strokeDasharray="4 3" />
        </svg>
      </div>
      <div className="flex justify-between font-mono text-[11px] text-ink-2 px-1">
        <span className="text-accent font-medium">— Field Pyranometer reads +8.1% vs Fleet Consensus</span>
        <span>Calibration Factor: 0.925</span>
      </div>
    </div>
  )
}
