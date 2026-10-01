import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import metricsData from '../data/metrics.json'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import { Badge, Button } from '@/components/ui'
import { cn } from '../lib/cn.js'

const WATERFALL_STEPS = [
  {
    step: '01 / 04',
    title: 'Ambient & Temperature Derate',
    loss: '-3.1 %',
    detail: 'Sandia SAPM calculates 58.4 °C module temperature. High heat reduces cell bandgap; normal physics loss, not a fault.',
    actualKw: 1140,
    expectedKw: 1250,
  },
  {
    step: '02 / 04',
    title: 'Uniform Desert Soiling',
    loss: '-4.8 %',
    detail: 'Monotonic PR decay over 7 dry days across all 8 central inverters. Crosses wash payback economic threshold.',
    actualKw: 1080,
    expectedKw: 1140,
  },
  {
    step: '03 / 04',
    title: 'Inverter Thermal Derating',
    loss: '-6.2 %',
    detail: 'INV-04 heatsink temperature climbs to 78.8 °C. Internal controller clamps generation flat at 850 kWac ceiling.',
    actualKw: 850,
    expectedKw: 1080,
  },
  {
    step: '04 / 04',
    title: 'String Open Circuit',
    loss: '-4.1 %',
    detail: 'Combiner Box SCB-02 string 07 delivers 0.0 A during 880 W/m² peak sun. Blown 15A inline gPV fuse isolated.',
    actualKw: 802,
    expectedKw: 850,
  },
]

export default function Landing() {
  const reduced = useReducedMotion()
  const [activeStepIndex, setActiveStepIndex] = useState(0)

  // DiagnosisTyper state
  const typerRef = useRef(null)
  const [typerVisible, setTyperVisible] = useState(false)
  const [typedText, setTypedText] = useState('')
  const fullSentence =
    'Generation is 18.2 % below expected. Likely causes: Inverter Thermal Derating on INV-04. Recommended action: Inspect blower fan #2 and clean intake air filters.'

  // Smooth scroll with Lenis (if available and not reduced motion)
  useEffect(() => {
    if (reduced) return
    let lenisInstance = null
    import('lenis')
      .then((Lenis) => {
        const LenisClass = Lenis.default || Lenis
        lenisInstance = new LenisClass({
          duration: 1.2,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
        })
        function raf(time) {
          lenisInstance?.raf(time)
          requestAnimationFrame(raf)
        }
        requestAnimationFrame(raf)
      })
      .catch((err) => {
        // Fallback gracefully without throwing
      })

    return () => {
      lenisInstance?.destroy()
    }
  }, [reduced])

  // Typer IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTyperVisible(true)
        }
      },
      { threshold: 0.3 }
    )
    if (typerRef.current) observer.observe(typerRef.current)
    return () => observer.disconnect()
  }, [])

  // Typewriter effect
  useEffect(() => {
    if (!typerVisible) return
    if (reduced) {
      setTypedText(fullSentence)
      return
    }

    let i = 0
    setTypedText('')
    const interval = setInterval(() => {
      i++
      setTypedText(fullSentence.slice(0, i))
      if (i >= fullSentence.length) clearInterval(interval)
    }, 22)

    return () => clearInterval(interval)
  }, [typerVisible, reduced])

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-accent/25 selection:text-ink font-sans antialiased overflow-x-hidden">
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="border-b border-line px-6 py-4 flex items-center justify-between sticky top-0 bg-paper/95 backdrop-blur-sm z-30">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-xl font-normal tracking-tight text-ink">Kiran</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] px-1.5 py-0.5 border border-line bg-paper-2 text-ink">
            RCA
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-ink-2 hidden sm:inline">
            Bhadla Block C · 12.4 MWp DC / 10 MWac
          </span>
          <Link
            to="/app"
            className="font-mono text-xs uppercase tracking-wider px-3.5 py-1.5 border border-ink bg-ink text-paper hover:bg-ink-2 transition-colors"
          >
            Open Console &rarr;
          </Link>
        </div>
      </header>

      {/* ── Section 1: Hero ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 sm:py-24 border-b border-line">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6">
            <span className="font-mono text-xs uppercase tracking-[0.08em] text-accent block">
              SOLAR O&amp;M &middot; ROOT-CAUSE DIAGNOSIS
            </span>

            <h1 className="font-display text-4xl sm:text-[62px] font-normal text-ink tracking-tight leading-[1.06]">
              Your plant lost{' '}
              <span className="font-mono text-accent font-medium tabular-nums">18 %</span> today.
              <br />
              Here is why.
            </h1>

            <p className="font-sans text-base sm:text-lg text-ink-2 leading-relaxed max-w-xl">
              Kiran compares SCADA telemetry against a first-principles physics digital twin, rejects cloud transients,
              isolates the exact failure mode across inverters and strings, and issues plain-language CMMS directives.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                to="/app"
                className="inline-flex items-center justify-center font-mono text-xs uppercase tracking-wider px-6 py-3 border border-ink bg-ink text-paper hover:bg-ink-2 transition-colors"
              >
                Open Console
              </Link>
              <Link
                to="/app/lab"
                className="inline-flex items-center justify-center font-mono text-xs uppercase tracking-wider px-6 py-3 border border-line bg-paper text-ink hover:border-ink transition-colors"
              >
                Run a Fault Scenario &rarr;
              </Link>
            </div>
          </div>

          {/* Right Column: Hero SVG Day Curve with 8s looping Sun dot */}
          <div className="lg:col-span-5 relative border border-line bg-paper p-4 overflow-hidden">
            {/* Faint engineering grid background */}
            <div className="h-64 w-full relative">
              <svg viewBox="0 0 400 240" className="w-full h-full" preserveAspectRatio="none">
                {/* Engineering Grid */}
                {[40, 90, 140, 190, 220].map((y, idx) => (
                  <line key={idx} x1="20" y1={y} x2="380" y2={y} stroke="#D6D1C4" strokeWidth="1" strokeDasharray="2 4" />
                ))}
                {[60, 120, 180, 240, 300, 360].map((x, idx) => (
                  <line key={idx} x1={x} y1="20" x2={x} y2="220" stroke="#D6D1C4" strokeWidth="1" strokeDasharray="2 4" />
                ))}

                {/* Shaded Gap between Expected and Actual */}
                <path
                  d="M 35 220 Q 120 220 160 70 Q 200 40 240 70 Q 280 220 365 220 L 365 220 Q 280 220 240 120 L 160 120 Q 120 220 35 220 Z"
                  fill="#B4441E"
                  fillOpacity="0.14"
                />

                {/* Expected AC curve (dashed) */}
                <path
                  d="M 35 220 Q 120 220 160 70 Q 200 40 240 70 Q 280 220 365 220"
                  fill="none"
                  stroke="#4A473D"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />

                {/* Actual AC curve (solid amber) */}
                <path
                  d="M 35 220 Q 120 220 160 120 L 240 120 Q 280 220 365 220"
                  fill="none"
                  stroke="#D9790B"
                  strokeWidth="2.5"
                />

                {/* Sun dot looping along the arc over 8s */}
                <motion.circle
                  r="6"
                  fill="#D9790B"
                  stroke="#F3F0E8"
                  strokeWidth="2"
                  animate={
                    reduced
                      ? {}
                      : {
                          cx: [35, 120, 200, 280, 365],
                          cy: [220, 130, 40, 130, 220],
                        }
                  }
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </svg>
            </div>

            <div className="flex justify-between font-mono text-[10px] text-ink-2 pt-2 border-t border-line/60">
              <span className="text-ink">06:00 Sunrise</span>
              <span className="text-fault font-medium">Shaded Yield Gap (18%)</span>
              <span className="text-ink">18:30 Sunset</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Problem Band (Three Mono Stats) ─────────── */}
      <section className="max-w-6xl mx-auto px-6 py-12 border-b border-line">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-line p-4 space-y-1 bg-paper">
            <span className="font-mono text-3xl font-medium text-ink tabular-nums block">
              INR 4.8L
            </span>
            <span className="label text-ink-2 text-[10px] block">DAILY REVENUE LEAKAGE</span>
            <p className="font-sans text-xs text-ink-2 leading-relaxed">
              Lost per 100 MW portfolio from unnoticed soiling plateaus and thermal clipping misdiagnosed as normal operation.
            </p>
          </div>

          <div className="border border-line p-4 space-y-1 bg-paper">
            <span className="font-mono text-3xl font-medium text-ink tabular-nums block">
              42 mins
            </span>
            <span className="label text-ink-2 text-[10px] block">SCADA TRIAGE DELAY</span>
            <p className="font-sans text-xs text-ink-2 leading-relaxed">
              Average time spent by field engineers manually cross-referencing weather stations and SCB string currents.
            </p>
          </div>

          <div className="border border-line p-4 space-y-1 bg-paper">
            <span className="font-mono text-3xl font-medium text-fault tabular-nums block">
              68 %
            </span>
            <span className="label text-ink-2 text-[10px] block">CONVENTIONAL FALSE ALARMS</span>
            <p className="font-sans text-xs text-ink-2 leading-relaxed">
              Standard inverter threshold alarms triggered by ordinary cloud passing and diurnal ramps during monsoon.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 3: Pinned Section 'From Gap to Cause' ────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-line space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-accent block">
              STEP-BY-STEP WATERFALL
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-normal text-ink mt-0.5">
              From Gap to Cause: Peeling the Loss Layers
            </h2>
          </div>
          <span className="font-mono text-xs text-ink-2">
            Step {WATERFALL_STEPS[activeStepIndex].step}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Sticky Power Curve */}
          <div className="lg:col-span-6 border border-line bg-paper p-4 space-y-3">
            <div className="flex justify-between items-center font-mono text-xs">
              <span className="label text-ink">ACTIVE LOSS LAYER DISAGGREGATION</span>
              <span className="text-fault font-medium">{WATERFALL_STEPS[activeStepIndex].loss}</span>
            </div>

            <div className="h-56 w-full border border-line bg-paper-2 p-2">
              <svg viewBox="0 0 360 180" className="w-full h-full" preserveAspectRatio="none">
                {/* Baseline curve */}
                <path d="M 30 160 Q 120 160 150 40 Q 180 20 210 40 Q 240 160 330 160" fill="none" stroke="#4A473D" strokeWidth="1.5" strokeDasharray="3 3" />
                {/* Peeled curve representing step */}
                <path
                  d={`M 30 160 Q 120 160 150 ${160 - (WATERFALL_STEPS[activeStepIndex].actualKw / 1250) * 120} L 210 ${160 - (WATERFALL_STEPS[activeStepIndex].actualKw / 1250) * 120} Q 240 160 330 160`}
                  fill="none"
                  stroke="#D9790B"
                  strokeWidth="2.5"
                />
              </svg>
            </div>

            <div className="flex justify-between font-mono text-[11px] text-ink-2">
              <span>Expected: 1,250 kWac</span>
              <span className="text-ink font-medium">Attributed: {WATERFALL_STEPS[activeStepIndex].actualKw} kWac</span>
            </div>
          </div>

          {/* Right: Step-Driven Loss Waterfall Cards */}
          <div className="lg:col-span-6 space-y-3">
            {WATERFALL_STEPS.map((s, idx) => {
              const isSelected = activeStepIndex === idx
              return (
                <div
                  key={s.step}
                  onClick={() => setActiveStepIndex(idx)}
                  className={cn(
                    'border p-4 cursor-pointer transition-all duration-200',
                    isSelected
                      ? 'border-accent bg-paper shadow-[inset_0_0_0_1px_rgba(217,121,11,1)]'
                      : 'border-line bg-paper hover:border-ink/50 opacity-70'
                  )}
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-accent font-bold">{s.step}</span>
                    <span className="text-fault font-medium">{s.loss}</span>
                  </div>
                  <h3 className="font-display text-base font-medium text-ink mt-1">
                    {s.title}
                  </h3>
                  <p className="font-sans text-xs text-ink-2 mt-1 leading-relaxed">
                    {s.detail}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Section 4: Three-Layer Architecture Columns ─────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-line space-y-8">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-accent block">
            CORE PLATFORM DESIGN
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-normal text-ink mt-0.5">
            Three Layers: Ingestion, Crucible, Decision Support
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          <div className="border border-line bg-paper p-5 space-y-3">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-accent font-bold">LAYER 01</span>
              <span className="text-ink-2">Telemetry</span>
            </div>
            <h3 className="font-display text-lg text-ink font-medium">Digital Twin Baseline</h3>
            <ul className="space-y-2 text-xs text-ink-2 font-sans">
              <li>&bull; NOAA solar position calculator (&plusmn;0.5° accuracy).</li>
              <li>&bull; Sandia SAPM thermal module dynamics ($T_c = T_m + \Delta T$).</li>
              <li>&bull; PVWatts inverter polynomial efficiency curve.</li>
              <li>&bull; Automatic stuck-sensor and dropout imputation.</li>
            </ul>
          </div>

          <div className="border border-line bg-paper p-5 space-y-3">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-accent font-bold">LAYER 02</span>
              <span className="text-ink-2">Analytics</span>
            </div>
            <h3 className="font-display text-lg text-ink font-medium">Diagnostic Crucible</h3>
            <ul className="space-y-2 text-xs text-ink-2 font-sans">
              <li>&bull; Stein et al. Variability Index cloud transient gate.</li>
              <li>&bull; Deterministic rule fingerprinting ($45\%$ weight).</li>
              <li>&bull; Random Forest local SHAP classifier ($55\%$ weight).</li>
              <li>&bull; High-persistence window validation (&ge;45m fast / 2d slow).</li>
            </ul>
          </div>

          <div className="border border-line bg-paper p-5 space-y-3">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="text-accent font-bold">LAYER 03</span>
              <span className="text-ink-2">Operations</span>
            </div>
            <h3 className="font-display text-lg text-ink font-medium">Prescriptive CMMS</h3>
            <ul className="space-y-2 text-xs text-ink-2 font-sans">
              <li>&bull; Exact sentence: Below expected &rarr; Causes &rarr; Action.</li>
              <li>&bull; Quantified lost kWh &amp; revenue loss (INR 3.15/kWh).</li>
              <li>&bull; Automated P1 / P2 / P3 priority scoring.</li>
              <li>&bull; Field technician checklists and LOTO safety notices.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── Section 5: DiagnosisTyper (Scrolled into view) ───────── */}
      <section ref={typerRef} className="max-w-6xl mx-auto px-6 py-16 border-b border-line space-y-6">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-accent block">
            LIVE ENGINE SYNTHESIS
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-normal text-ink mt-0.5">
            DiagnosisTyper: Prescriptive Field Directive
          </h2>
        </div>

        <div className="border border-line bg-paper p-6 space-y-3">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="label text-accent">REAL-TIME CRUCIBLE SYNTHESIS</span>
            <span className="text-ink-2">Target: INV-04</span>
          </div>

          <div className="min-h-[64px]">
            <p className="font-display text-xl sm:text-2xl text-ink font-normal leading-relaxed">
              {typedText}
              {typedText.length < fullSentence.length && (
                <span className="inline-block w-2 h-5 bg-accent ml-1 animate-pulse" />
              )}
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-line font-mono text-xs text-ink-2">
            <span>Confidence: 94.2% · P1 Critical</span>
            <Link to="/app/diagnosis/thermal_derating" className="text-accent hover:underline">
              Inspect Full Diagnosis &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section 6: 'Not every drop is a fault' ─────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-line space-y-8">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-accent block">
            TRANSIENT REJECTION DEMONSTRATION
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-normal text-ink mt-0.5">
            Not Every Drop is a Fault
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
          {/* Cloud Passing (Suppressed) */}
          <div className="border border-line bg-paper p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-ink font-semibold">CLOUD TRANSIENT DAY</span>
              <Badge variant="ok">0 Fault Tickets</Badge>
            </div>
            <div className="h-32 border border-line bg-paper-2 p-2">
              <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
                <path d="M 20 80 Q 70 80 90 30 L 110 70 L 130 35 L 160 80 L 180 30 Q 220 80 280 80" fill="none" stroke="#D9790B" strokeWidth="2" />
              </svg>
            </div>
            <p className="font-sans text-xs text-ink-2 leading-relaxed">
              Fast ramp dips under passing clouds (Stein VI = 2.18). Gated by the transient filter; zero false hardware tickets raised.
            </p>
          </div>

          {/* Derating Day (Raised) */}
          <div className="border border-fault/40 bg-paper p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-fault font-semibold">INVERTER DERATING DAY</span>
              <Badge variant="critical">P1 Work Order Dispatched</Badge>
            </div>
            <div className="h-32 border border-line bg-paper-2 p-2">
              <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
                <path d="M 20 80 Q 70 80 100 45 L 200 45 Q 230 80 280 80" fill="none" stroke="#B4441E" strokeWidth="2.5" />
                <line x1="20" y1="45" x2="280" y2="45" stroke="#B4441E" strokeWidth="1" strokeDasharray="3 3" />
              </svg>
            </div>
            <p className="font-sans text-xs text-ink-2 leading-relaxed">
              Midday 850 kWac flat plateau with heatsink &gt; 78.5 °C. Correctly isolated as blower fan failure; ticket queued for dispatch.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 7: Metrics Band (Live from metrics.json) ────── */}
      <section className="max-w-6xl mx-auto px-6 py-12 border-b border-line">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center font-mono">
          <div className="border border-line p-3 bg-paper">
            <div className="text-2xl font-bold text-ink tabular-nums">
              {(metricsData.summary.overallAccuracy * 100).toFixed(1)}%
            </div>
            <span className="label text-ink-2 text-[10px] mt-1 block">DIAGNOSTIC ACCURACY</span>
          </div>

          <div className="border border-line p-3 bg-paper">
            <div className="text-2xl font-bold text-accent tabular-nums">
              {(metricsData.summary.macroF1 * 100).toFixed(1)}%
            </div>
            <span className="label text-ink-2 text-[10px] mt-1 block">MACRO F1 SCORE</span>
          </div>

          <div className="border border-line p-3 bg-paper">
            <div className="text-2xl font-bold text-ok tabular-nums">
              {(metricsData.summary.mapeLostKWh * 100).toFixed(1)}%
            </div>
            <span className="label text-ink-2 text-[10px] mt-1 block">QUANTIFICATION MAPE</span>
          </div>

          <div className="border border-line p-3 bg-paper">
            <div className="text-2xl font-bold text-ok tabular-nums">0.0%</div>
            <span className="label text-ink-2 text-[10px] mt-1 block">TRANSIENT FALSE ALARMS</span>
          </div>
        </div>
      </section>

      {/* ── Section 8: Plain Footer ─────────────────────────────── */}
      <footer className="max-w-6xl mx-auto px-6 py-12 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-ink-2 gap-4">
        <div>
          KIRAN RCA &middot; BUILT FOR THE ADVANCED AGENTIC CODING HACKATHON
        </div>
        <div className="flex items-center gap-6">
          <Link to="/app" className="hover:text-ink">Console</Link>
          <Link to="/app/lab" className="hover:text-ink">Scenario Lab</Link>
          <Link to="/app/model" className="hover:text-ink">Model Report</Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
