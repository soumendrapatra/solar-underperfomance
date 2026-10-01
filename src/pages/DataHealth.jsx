import { useState, useMemo } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { Card, Badge, Button, Stat } from '@/components/ui'
import { usePlantStore } from '../store/usePlantStore.js'
import { SPRING_CONFIG } from '../lib/constants.js'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn.js'

export default function DataHealth() {
  const { portfolio, selectedPlantId, setSelectedPlantId, telemetryCache, diagnoses } = usePlantStore()
  const [bypassSanity, setBypassSanity] = useState(false)
  const [showCorrectedPoa, setShowCorrectedPoa] = useState(true)

  const activePlant = useMemo(() => {
    return portfolio.find((p) => p.id === selectedPlantId) || portfolio[0]
  }, [portfolio, selectedPlantId])

  const telemetry = telemetryCache[selectedPlantId]
  const records = telemetry?.records || []

  // Check if active plant has sensor drift condition (Kurnool East or injected)
  const isDriftPlant = selectedPlantId === 'kurnool-east'
  const driftFactor = isDriftPlant ? 1.081 : 1.002
  const driftPct = isDriftPlant ? 8.1 : 0.2

  // Channel health definitions
  const channelData = useMemo(() => {
    return [
      {
        channel: 'POA Irradiance #1',
        asset: 'WMS Primary (Tilt 25°)',
        completeness: 99.8,
        stuckWindows: 0,
        driftStatus: isDriftPlant ? '+8.1% Drift' : 'Calibrated',
        driftVariant: isDriftPlant ? 'medium' : 'ok',
        healthScore: isDriftPlant ? 84 : 99,
        dailyCompleteness: [100, 100, 99.5, 100, 100, 99.2, 100],
      },
      {
        channel: 'POA Irradiance #2 (Secondary)',
        asset: 'WMS Secondary Met Mast',
        completeness: 99.1,
        stuckWindows: 0,
        driftStatus: 'Calibrated',
        driftVariant: 'ok',
        healthScore: 98,
        dailyCompleteness: [100, 98.2, 100, 100, 99.1, 100, 98.6],
      },
      {
        channel: 'Back-of-Module Temp (BOM)',
        asset: 'Array Zone C Row 14',
        completeness: 99.6,
        stuckWindows: 0,
        driftStatus: 'Calibrated',
        driftVariant: 'ok',
        healthScore: 97,
        dailyCompleteness: [100, 100, 100, 98.5, 100, 100, 99.0],
      },
      {
        channel: 'Ambient Temperature & WS',
        asset: 'WMS Met Mast 10m',
        completeness: 100.0,
        stuckWindows: 0,
        driftStatus: 'Calibrated',
        driftVariant: 'ok',
        healthScore: 100,
        dailyCompleteness: [100, 100, 100, 100, 100, 100, 100],
      },
      {
        channel: 'Inverter Active Power Pac (8x)',
        asset: 'INV-01 to INV-08',
        completeness: 100.0,
        stuckWindows: 0,
        driftStatus: 'Calibrated',
        driftVariant: 'ok',
        healthScore: 100,
        dailyCompleteness: [100, 100, 100, 100, 100, 100, 100],
      },
      {
        channel: 'Combiner Box String Currents',
        asset: 'SCB-01 to SCB-04 (48 Strings)',
        completeness: 98.9,
        stuckWindows: selectedPlantId === 'pavagada-p4' ? 1 : 0,
        driftStatus: 'Calibrated',
        driftVariant: 'ok',
        healthScore: selectedPlantId === 'pavagada-p4' ? 88 : 96,
        dailyCompleteness: [98.2, 99.0, 99.0, 97.8, 100, 99.2, 98.8],
      },
    ]
  }, [isDriftPlant, selectedPlantId])

  // Human-readable issues feed from sanityReport
  const issuesFeed = useMemo(() => {
    const list = []
    if (isDriftPlant) {
      list.push({
        id: 'drift-1',
        severity: 'high',
        text: 'WMS pyranometer reading +8.1 % above fleet-implied irradiance consensus over 7 consecutive clear diurnal cycles.',
        action: 'Engine action: Auto-calibrating POA series with factor 0.925 to suppress bogus soiling alarms.',
        time: 'Active since 12 Mar 06:00 IST',
      })
    }
    if (selectedPlantId === 'pavagada-p4') {
      list.push({
        id: 'stuck-1',
        severity: 'critical',
        text: 'Combiner Box SCB-02 string 07 current frozen at 0.0 A for 1,420 daylight minutes (POA > 200 W/m²).',
        action: 'Engine action: Classified as physical open circuit disconnected branch; passed to root-cause fusion.',
        time: 'Day 3 through Day 7',
      })
    }
    list.push({
      id: 'drop-1',
      severity: 'low',
      text: 'BOM module temperature sensor reported 4 null intervals (&le;15 min) during morning ramp on 14 Mar.',
      action: 'Engine action: Forward-filled via Sandia SAPM physical thermal model; marked as isImputed.',
      time: '14 Mar 07:15 IST',
    })
    list.push({
      id: 'range-1',
      severity: 'low',
      text: 'Physical range checks passed: zero values out of bounds (POA 0-1500, Tamb -10 to 60, Heatsink 0-110°C).',
      action: 'Engine action: Physical sanity integrity validated.',
      time: 'Full 2,016 intervals',
    })
    return list
  }, [isDriftPlant, selectedPlantId])

  // False alarms count when sanity checks are bypassed
  const rawFalseAlarmsCount = isDriftPlant ? 8 : selectedPlantId === 'pavagada-p4' ? 3 : 2

  // Generate comparison curve points
  const driftChartPoints = useMemo(() => {
    const points = []
    for (let i = 0; i < 48; i++) {
      const hour = 6.0 + (i / 47) * 12.0
      const clearSky = Math.max(0, Math.round(920 * Math.sin(((hour - 6.0) / 12.0) * Math.PI)))
      const implied = Math.round(clearSky * 0.98)
      const wmsObserved = isDriftPlant ? Math.round(implied * 1.081) : implied
      const corrected = Math.round(wmsObserved / driftFactor)
      points.push({
        hour: `${Math.floor(hour)}:${Math.floor((hour % 1) * 60).toString().padStart(2, '0')}`,
        clearSky,
        implied,
        wmsObserved,
        corrected,
      })
    }
    return points
  }, [isDriftPlant, driftFactor])

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="SCADA Integrity · Data QC & Calibration"
        title="Data Health & Quality Gates"
        description="Pre-diagnostic sanitization: missing timestamp repair, frozen value detection, physical range boundaries, and fleet-implied pyranometer recalibration."
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="label text-ink-2 text-[10px]">Target Asset:</span>
            <select
              value={selectedPlantId}
              onChange={(e) => setSelectedPlantId(e.target.value)}
              className="bg-paper border border-line px-2 py-1 font-mono text-xs text-ink focus:outline-none focus:border-accent"
            >
              {portfolio.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </PageHeader>

      {/* Bypass Sanity Toggle Warning Banner */}
      <div className="border border-line bg-paper p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-ink">
              Toggle Raw Data Ingestion (Bypass Sanity Checks)
            </span>
            {bypassSanity && <Badge variant="critical">Sanity Bypassed</Badge>}
          </div>
          <p className="font-sans text-xs text-ink-2">
            Simulates diagnosing on raw un-sanitized telemetry to demonstrate false alarm generation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={bypassSanity}
            onClick={() => setBypassSanity(!bypassSanity)}
            className={cn(
              'w-10 h-5 rounded-full p-0.5 transition-colors focus:outline-none',
              bypassSanity ? 'bg-fault' : 'bg-line'
            )}
          >
            <motion.div
              layout
              transition={SPRING_CONFIG}
              className={cn(
                'w-4 h-4 rounded-full bg-paper shadow-sm',
                bypassSanity ? 'ml-auto' : 'mr-auto'
              )}
            />
          </button>
        </div>
      </div>

      {bypassSanity && (
        <div className="border border-fault bg-fault/10 p-4 space-y-1">
          <div className="flex items-center justify-between font-mono text-xs text-fault font-bold uppercase">
            <span>Critical QC Alert: Sanity Checks Disabled</span>
            <span>+{rawFalseAlarmsCount} False Hardware Alarms Generated</span>
          </div>
          <p className="font-sans text-xs text-ink leading-relaxed">
            Without stuck value and pyranometer drift correction, the uncalibrated irradiance error (+8.1%) creates
            an apparent yield gap across all 8 central inverters, falsely raising {rawFalseAlarmsCount} bogus &quot;Uniform Soiling&quot;
            and &quot;Inverter Underperformance&quot; work orders.
          </p>
        </div>
      )}

      {/* Pyranometer Drift Card */}
      <Card
        figure="01"
        header="Pyranometer Calibration Drift vs Fleet-Implied Consensus"
        headerRight={
          <Badge variant={isDriftPlant ? 'medium' : 'ok'}>
            {isDriftPlant ? `Drift Factor: ${driftFactor.toFixed(3)} (+${driftPct}%)` : 'Factory Calibrated'}
          </Badge>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-2 font-mono text-xs">
            <span className="text-ok font-medium">
              &bull; Using corrected series for diagnosis since 12 Mar (Drift factor {driftFactor.toFixed(3)})
            </span>
            <label className="flex items-center gap-1.5 cursor-pointer text-ink select-none text-[11px]">
              <input
                type="checkbox"
                checked={showCorrectedPoa}
                onChange={(e) => setShowCorrectedPoa(e.target.checked)}
                className="accent-accent"
              />
              <span>Overlay Corrected POA</span>
            </label>
          </div>

          {/* SVG Comparative Chart */}
          <div className="border border-line bg-paper-2 p-3">
            <div className="h-48 w-full">
              <svg viewBox="0 0 600 170" className="w-full h-full" preserveAspectRatio="none">
                {/* Horizontal Grid */}
                {[25, 65, 105, 145].map((y, idx) => (
                  <line key={idx} x1="40" y1={y} x2="590" y2={y} stroke="#D6D1C4" strokeWidth="1" strokeDasharray="2 4" />
                ))}
                <text x="32" y="29" textAnchor="end" className="text-[10px] font-mono fill-ink-2">1000 W/m²</text>
                <text x="32" y="69" textAnchor="end" className="text-[10px] font-mono fill-ink-2">750</text>
                <text x="32" y="109" textAnchor="end" className="text-[10px] font-mono fill-ink-2">500</text>
                <text x="32" y="149" textAnchor="end" className="text-[10px] font-mono fill-ink-2">0</text>

                {/* Clear Sky curve (dotted line) */}
                <path
                  d={driftChartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${45 + (i / 47) * 540} ${145 - (p.clearSky / 1000) * 120}`).join(' ')}
                  fill="none"
                  stroke="#4A473D"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* Fleet Implied Irradiance (Grey dashed line) */}
                <path
                  d={driftChartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${45 + (i / 47) * 540} ${145 - (p.implied / 1000) * 120}`).join(' ')}
                  fill="none"
                  stroke="#16150F"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                {/* WMS Observed POA (Amber solid line) */}
                <path
                  d={driftChartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${45 + (i / 47) * 540} ${145 - (p.wmsObserved / 1000) * 120}`).join(' ')}
                  fill="none"
                  stroke="#D9790B"
                  strokeWidth="2.5"
                />

                {/* Corrected Series (Green line) */}
                {showCorrectedPoa && isDriftPlant && (
                  <path
                    d={driftChartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${45 + (i / 47) * 540} ${145 - (p.corrected / 1000) * 120}`).join(' ')}
                    fill="none"
                    stroke="#4F6B2A"
                    strokeWidth="2"
                  />
                )}
              </svg>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line/60 font-mono text-[11px]">
              <div className="flex items-center gap-4">
                <span className="text-accent font-medium">— WMS Observed POA</span>
                <span className="text-ink font-medium">- - Fleet-Implied POA (Consensus)</span>
                <span className="text-ink-2">&middot;&middot; Clear-Sky Twin</span>
                {showCorrectedPoa && isDriftPlant && (
                  <span className="text-ok font-medium">— Calibrated Series</span>
                )}
              </div>
              <span className="text-ink-2 text-[10px]">Diurnal Clear Period 06:00 - 18:00</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Channel Health Table */}
      <Card figure="02" header="SCADA Channel Health & Drift Status">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-line bg-paper-2">
                <th className="py-2.5 px-3 label text-ink-2">Channel</th>
                <th className="py-2.5 px-3 label text-ink-2">Asset Location</th>
                <th className="py-2.5 px-3 label text-ink-2">Completeness</th>
                <th className="py-2.5 px-3 label text-ink-2">Stuck Windows</th>
                <th className="py-2.5 px-3 label text-ink-2">Drift Status</th>
                <th className="py-2.5 px-3 label text-ink-2">Health Score</th>
              </tr>
            </thead>
            <tbody>
              {channelData.map((row, idx) => (
                <tr key={idx} className="border-b border-line hover:bg-paper-2/40">
                  <td className="py-2.5 px-3 font-medium text-ink">{row.channel}</td>
                  <td className="py-2.5 px-3 text-ink-2 font-sans">{row.asset}</td>
                  <td className="py-2.5 px-3 tabular-nums">{row.completeness}%</td>
                  <td className="py-2.5 px-3 tabular-nums">{row.stuckWindows} windows</td>
                  <td className="py-2.5 px-3">
                    <Badge variant={row.driftVariant}>{row.driftStatus}</Badge>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-paper-2 border border-line overflow-hidden">
                        <div
                          className={cn('h-full', row.healthScore > 90 ? 'bg-ok' : 'bg-warn')}
                          style={{ width: `${row.healthScore}%` }}
                        />
                      </div>
                      <span className="tabular-nums font-medium text-ink">{row.healthScore}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Completeness Calendar: 7 Days by Channel Small Squares */}
      <Card figure="03" header="7-Day SCADA Completeness Calendar (Days by Channel)">
        <div className="space-y-3 font-mono text-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-paper-2">
                  <th className="py-2 px-3 label text-ink-2 w-48">Telemetry Channel</th>
                  {['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'].map((d) => (
                    <th key={d} className="py-2 px-2 label text-ink-2 text-center">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {channelData.map((row, idx) => (
                  <tr key={idx} className="border-b border-line hover:bg-paper-2/40">
                    <td className="py-2 px-3 text-ink font-sans font-medium text-xs">{row.channel}</td>
                    {row.dailyCompleteness.map((pct, dIdx) => (
                      <td key={dIdx} className="py-2 px-2 text-center">
                        <div
                          className={cn(
                            'w-7 h-7 mx-auto flex items-center justify-center font-mono text-[9px] border',
                            pct === 100
                              ? 'bg-ok/20 border-ok text-ok'
                              : pct >= 99
                              ? 'bg-ok/10 border-ok/60 text-ok'
                              : 'bg-warn/15 border-warn text-warn'
                          )}
                          title={`${row.channel} ${dIdx + 1}: ${pct}%`}
                        >
                          {pct.toFixed(0)}%
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-ink-2 pt-1 border-t border-line/60">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-ok/20 border border-ok inline-block" />
              <span>100% Full Interval Capture (288 / 288)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-warn/15 border border-warn inline-block" />
              <span>&lt; 99% Minor Dropouts Forward-filled (&le;15m)</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Issues Feed (Human Sentences from Sanity Report) */}
      <Card figure="04" header="Sanity Report Issues Feed">
        <div className="space-y-2.5">
          {issuesFeed.map((issue) => (
            <div
              key={issue.id}
              className={cn(
                'border p-3 space-y-1',
                issue.severity === 'critical'
                  ? 'border-fault/40 bg-fault/5'
                  : issue.severity === 'high'
                  ? 'border-warn/40 bg-warn/5'
                  : 'border-line bg-paper-2/40'
              )}
            >
              <div className="flex items-center justify-between font-mono text-[10px]">
                <Badge variant={issue.severity === 'critical' ? 'critical' : issue.severity === 'high' ? 'medium' : 'info'}>
                  {issue.severity.toUpperCase()}
                </Badge>
                <span className="text-ink-2">{issue.time}</span>
              </div>
              <p className="font-sans text-xs text-ink font-medium leading-snug">{issue.text}</p>
              <p className="font-mono text-[11px] text-accent leading-snug">{issue.action}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
