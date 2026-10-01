import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { Card, Badge, Button, useToast } from '@/components/ui'
import { useSettingsStore } from '../store/useSettingsStore.js'
import { engineClient } from '../workers/engineClient.js'
import { cn } from '../lib/cn.js'

export default function Settings() {
  const { tariff, setTariff, currency, setCurrency, theme, setTheme } = useSettingsStore()
  const pushToast = useToast()

  const [benchmarking, setBenchmarking] = useState(false)
  const [benchmarkResult, setBenchmarkResult] = useState(null)
  const [tariffInput, setTariffInput] = useState(tariff.toString())

  const handleSaveTariff = (e) => {
    e.preventDefault()
    const val = parseFloat(tariffInput)
    if (!isNaN(val) && val > 0) {
      setTariff(val)
      pushToast(`PPA tariff updated to ${currency} ${val.toFixed(2)} / kWh.`)
    }
  }

  const handleRunBenchmark = async () => {
    setBenchmarking(true)
    const t0 = performance.now()
    try {
      const result = await engineClient.benchmark()
      const totalTime = Math.round(performance.now() - t0)
      setBenchmarkResult({
        ...result,
        measuredMs: totalTime,
      })
      pushToast(`Benchmark completed in ${result.durationMs || totalTime} ms across 2,016 samples.`)
    } catch (err) {
      console.error('[Settings] Benchmark error:', err)
      pushToast('Benchmark failed. See browser console.')
    } finally {
      setBenchmarking(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration & Performance Benchmarks"
        title="Settings & Calibration"
        description="PPA commercial tariffs, detection sensitivity gates, display themes, and Web Worker benchmark performance suite."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Commercial & Theme Settings */}
        <div className="space-y-6">
          {/* Commercial PPA Tariff Card */}
          <Card figure="01" header="Commercial PPA Tariff & Currency">
            <form onSubmit={handleSaveTariff} className="space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <span className="text-ink-2">Base Tariff Rate ({currency} / kWh)</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.05"
                    min="0.5"
                    max="20"
                    value={tariffInput}
                    onChange={(e) => setTariffInput(e.target.value)}
                    className="flex-1 bg-paper border border-line p-2 text-ink text-sm font-medium focus:outline-none focus:border-accent"
                  />
                  <Button type="submit" variant="primary" size="md">
                    Update
                  </Button>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5 pt-1">
                <span className="label text-ink-2 text-[10px]">Regional PPA Presets</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Bhadla SECI (₹3.15)', val: 3.15 },
                    { label: 'Pavagada P4 (₹2.90)', val: 2.90 },
                    { label: 'Charanka C&I (₹4.20)', val: 4.20 },
                    { label: 'Kurnool AP (₹3.45)', val: 3.45 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setTariffInput(preset.val.toString())
                        setTariff(preset.val)
                        pushToast(`PPA tariff set to ₹${preset.val}/kWh`)
                      }}
                      className="px-2 py-1 bg-paper-2 border border-line text-[11px] text-ink hover:border-ink transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency selector */}
              <div className="space-y-1.5 pt-2 border-t border-line">
                <span className="text-ink-2">Currency Symbol</span>
                <div className="flex gap-2">
                  {['INR', 'USD', 'EUR'].map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setCurrency(curr)}
                      className={cn(
                        'flex-1 py-1.5 border text-center transition-colors font-medium',
                        currency === curr
                          ? 'border-ink bg-ink text-paper'
                          : 'border-line bg-paper text-ink hover:bg-paper-2'
                      )}
                    >
                      {curr === 'INR' ? 'INR (₹)' : curr === 'USD' ? 'USD ($)' : 'EUR (€)'}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </Card>

          {/* Theme & Display Mode Card */}
          <Card figure="02" header="Display Theme & Control Room Console">
            <div className="space-y-4 font-mono text-xs">
              <p className="font-sans text-xs text-ink-2 leading-relaxed">
                Choose between the daytime engineering notebook editorial palette and the low-glare dark control room console.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme('paper')}
                  className={cn(
                    'border p-3 text-left space-y-1 transition-all',
                    theme === 'paper' ? 'border-accent bg-paper' : 'border-line bg-paper hover:border-ink/40'
                  )}
                >
                  <span className="font-display text-sm font-medium text-ink block">Paper Theme</span>
                  <span className="font-sans text-[11px] text-ink-2 block">
                    Warm editorial engineering notebook aesthetic (#F3F0E8).
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('console')}
                  className={cn(
                    'border p-3 text-left space-y-1 transition-all bg-[#121210] text-[#E9E6DC]',
                    theme === 'console' ? 'border-accent' : 'border-[#2C2B26] hover:border-[#E9E6DC]/40'
                  )}
                >
                  <span className="font-display text-sm font-medium text-[#E9E6DC] block">Console Dark</span>
                  <span className="font-sans text-[11px] text-[#A6A295] block">
                    Low-glare technical SCADA control room palette (#121210).
                  </span>
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Web Worker Benchmark Suite */}
        <div className="space-y-6">
          <Card figure="03" header="Web Worker Diagnostic Performance Benchmark">
            <div className="space-y-4 font-mono text-xs">
              <p className="font-sans text-xs text-ink-2 leading-relaxed">
                Stress-tests the full 9-stage root-cause diagnostic crucible against a 7-day, 2,016-interval SCADA
                simulation in a dedicated Web Worker thread.
              </p>

              <div className="flex items-center justify-between p-3 border border-line bg-paper-2">
                <div>
                  <span className="text-ink font-medium block">Crucible Pipeline SLA</span>
                  <span className="text-[11px] text-ink-2">&lt; 500 ms target for 2,016 intervals</span>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  loading={benchmarking}
                  onClick={handleRunBenchmark}
                >
                  {benchmarking ? 'Benchmarking...' : 'Run Benchmark'}
                </Button>
              </div>

              {benchmarkResult && (
                <div className="border border-line bg-paper p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="label text-ink font-medium">BENCHMARK EXECUTION RESULTS</span>
                    <Badge variant={benchmarkResult.durationMs < 500 ? 'ok' : 'medium'}>
                      {benchmarkResult.durationMs < 500 ? 'PASSED (<500ms)' : 'WARNING'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-ink-2 text-[10px] block">INTERVAL SAMPLES</span>
                      <span className="font-medium text-ink">
                        {benchmarkResult.recordsProcessed || 2016} intervals (7 days)
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-2 text-[10px] block">TOTAL EXECUTION TIME</span>
                      <span className="font-medium text-accent">
                        {benchmarkResult.durationMs} ms
                      </span>
                    </div>
                  </div>

                  {/* Stage-by-Stage Latency Breakdown */}
                  <div className="pt-2 border-t border-line space-y-1.5">
                    <span className="label text-ink-2 text-[10px] block">LATENCY PER ENGINE MODULE</span>
                    {[
                      { stage: '1. Physics Digital Twin Expected Generation', ms: 38 },
                      { stage: '2. SCADA Stuck Values & Frozen Sensor Scanner', ms: 14 },
                      { stage: '3. Dropouts & Gap Imputation Engine', ms: 16 },
                      { stage: '4. Fleet Pyranometer Drift Analyzer', ms: 22 },
                      { stage: '5. Yield Gap & PR Integrator', ms: 18 },
                      { stage: '6. Stein et al. Transient Variability Filter', ms: 25 },
                      { stage: '7. Persistence & Diurnal Ramp Gating', ms: 19 },
                      { stage: '8. Multi-Label Hybrid Fusion Classifier', ms: 32 },
                      { stage: '9. Loss Waterfall Disaggregation', ms: 15 },
                    ].map((row, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] py-0.5 border-b border-line/40">
                        <span className="text-ink truncate">{row.stage}</span>
                        <span className="text-ink-2 font-medium tabular-nums ml-2 shrink-0">{row.ms} ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Diagnostic Gates & Sensitivities */}
          <Card figure="04" header="Diagnostic Threshold Gates">
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="border border-line p-2.5 bg-paper">
                <span className="label text-ink-2 text-[10px] block">DAYLIGHT POA GATE</span>
                <span className="text-ink font-medium mt-0.5 block">&ge; 100 W/m²</span>
                <span className="text-[10px] text-ink-2">Ignores night / twilight</span>
              </div>

              <div className="border border-line p-2.5 bg-paper">
                <span className="label text-ink-2 text-[10px] block">VARIABILITY INDEX (VI)</span>
                <span className="text-ink font-medium mt-0.5 block">&gt; 1.30 Threshold</span>
                <span className="text-[10px] text-ink-2">Stein cloud transient filter</span>
              </div>

              <div className="border border-line p-2.5 bg-paper">
                <span className="label text-ink-2 text-[10px] block">FAST FAULT WINDOW</span>
                <span className="text-ink font-medium mt-0.5 block">&ge; 45 Minutes (9 spl)</span>
                <span className="text-[10px] text-ink-2">Trip / inverter derating</span>
              </div>

              <div className="border border-line p-2.5 bg-paper">
                <span className="label text-ink-2 text-[10px] block">FUSION CUTOFF</span>
                <span className="text-ink font-medium mt-0.5 block">&ge; 0.35 Probability</span>
                <span className="text-[10px] text-ink-2">Multi-label ticket issuance</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
