import { PageHeader } from '../components/layout/PageHeader.jsx'
import { Card, Badge } from '@/components/ui'
import { BRAND, COLLEGE, CAMPUS_SOLAR_ZONES, ASSUMPTIONS, DEFAULT_SETTINGS } from '../config/campus.js'

export default function Methodology() {
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12 font-sans text-ink">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <PageHeader
        eyebrow="ACADEMIC PROTOTYPE · METHODOLOGY & ARCHITECTURE"
        title="Project Methodology & Engineering Design"
        description="Detailed technical breakdown of the SolarPower campus solar monitoring and fault diagnosis system developed for Government College of Engineering Kalahandi."
      >
        <Badge variant="ok">GCE Kalahandi Prototype</Badge>
      </PageHeader>

      {/* ── Academic Honesty Banner ─────────────────────────────────── */}
      <div className="border border-line bg-paper-2/60 p-4 space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-accent font-semibold uppercase tracking-wider">
            Academic Prototype · Simulated Telemetry Notice
          </span>
        </div>
        <p className="text-ink-2 leading-relaxed">
          Telemetry is generated from a photovoltaic physics model and synthetic fault scenarios.
          This software is designed as an academic prototype for {COLLEGE.name}, demonstrating automated diagnostic intelligence prior to live physical instrumentation.
        </p>
      </div>

      {/* ── 1. Project Objective ────────────────────────────────────── */}
      <Card figure="01" header="1. Project Objective">
        <div className="p-4 space-y-3 text-xs leading-relaxed text-ink-2">
          <p className="text-sm font-medium text-ink">
            &ldquo;The objective of SolarPower is to demonstrate a campus-level rooftop solar monitoring and fault diagnosis prototype for Government College of Engineering Kalahandi.&rdquo;
          </p>
          <p>
            Distributed rooftop solar arrays across educational institutions suffer unnoticed yield loss from desert dust accumulation, local tree/parapet shading, inverter thermal throttling during summer months, and blown branch fuses. SolarPower bridges this gap by calculating expected generation in real time and comparing it against electrical telemetry to generate actionable maintenance directives for campus electrical technicians.
          </p>
        </div>
      </Card>

      {/* ── 2. Campus Solar Zones ───────────────────────────────────── */}
      <Card figure="02" header="2. Campus Rooftop Solar Zones">
        <div className="p-4 space-y-3 text-xs">
          <p className="text-ink-2">
            The college campus installation is divided into 5 distinct rooftop zones covering academic, workshop, library, and departmental buildings ({COLLEGE.departments.join(', ')}):
          </p>
          <div className="overflow-x-auto border border-line">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-paper-2 border-b border-line text-[11px] text-ink-2">
                  <th className="p-2.5">Zone</th>
                  <th className="p-2.5">Building</th>
                  <th className="p-2.5 text-right">DC (kWp)</th>
                  <th className="p-2.5 text-right">AC (kWac)</th>
                  <th className="p-2.5">Inverters</th>
                  <th className="p-2.5">Primary Monitored Mode</th>
                </tr>
              </thead>
              <tbody>
                {CAMPUS_SOLAR_ZONES.map((z) => (
                  <tr key={z.id} className="border-b border-line/60 hover:bg-paper-2/40">
                    <td className="p-2.5 font-bold text-accent">{z.zoneId}</td>
                    <td className="p-2.5 font-sans font-medium text-ink">{z.name}</td>
                    <td className="p-2.5 text-right tabular-nums">{z.capacityDcKw}</td>
                    <td className="p-2.5 text-right tabular-nums">{z.capacityAcKw}</td>
                    <td className="p-2.5 text-ink-2">{z.inverters.join(', ')}</td>
                    <td className="p-2.5 text-ink-2 font-sans">{z.defaultIssue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* ── 3. Data Source and Assumptions ──────────────────────────── */}
      <Card figure="03" header="3. Data Source and Modeling Assumptions">
        <div className="p-4 space-y-3 text-xs leading-relaxed text-ink-2">
          <p className="text-ink font-medium">
            &ldquo;The current prototype uses simulated telemetry because live inverter SCADA data is not yet available.&rdquo;
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1">
            {ASSUMPTIONS.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
            <li>Assumed institutional electricity tariff: <strong>INR {DEFAULT_SETTINGS.tariffInrPerKwh.toFixed(2)}/kWh</strong> for cost impact calculations.</li>
            <li>Coordinates for solar zenith and azimuth calculations: <strong>{COLLEGE.coordinates.lat}° N, {COLLEGE.coordinates.lon}° E</strong> ({COLLEGE.location}).</li>
          </ul>
        </div>
      </Card>

      {/* ── 4. Expected Generation & Fault Diagnostics ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card figure="04" header="4. Expected Generation Digital Twin">
          <div className="p-4 space-y-2 text-xs leading-relaxed text-ink-2">
            <p>
              Expected power is computed using a simplified PV physics pipeline inspired by Sandia (SAPM) and PVWatts:
            </p>
            <ol className="list-decimal list-inside space-y-1 font-mono text-[11px] text-ink">
              <li>NOAA Solar Position Algorithm (Zenith &amp; Azimuth)</li>
              <li>Sandia Cell Temp Model: <span className="text-accent">Tc = Ta + E &times; e^(a + b&times;WS) + dT</span></li>
              <li>Temperature-corrected DC Power with Gamma = -0.35 %/°C</li>
              <li>Part-load inverter efficiency clipping at AC rated capacity</li>
            </ol>
          </div>
        </Card>

        <Card figure="05" header="5. Fault Signatures Detected">
          <div className="p-4 space-y-2 text-xs leading-relaxed text-ink-2">
            <p>
              The engine isolates four distinct hardware and environmental failure signatures:
            </p>
            <ul className="space-y-1.5 font-mono text-[11px] text-ink">
              <li>&bull; <strong className="text-ink">Uniform Dust / Soiling:</strong> Monotonic daily PR decay across all zone strings.</li>
              <li>&bull; <strong className="text-ink">Morning Shading:</strong> Repeatable time-of-day dip during low sun elevation (&lt;25°).</li>
              <li>&bull; <strong className="text-ink">Inverter Overheating:</strong> Power plateauing with heatsink temp &gt; 75°C.</li>
              <li>&bull; <strong className="text-ink">String Mismatch:</strong> Outlier zero-current branch on combiner box.</li>
            </ul>
          </div>
        </Card>
      </div>

      {/* ── 6. Machine Learning Role ─────────────────────────────────── */}
      <Card figure="06" header="6. Machine Learning Role in Diagnostic Fusion">
        <div className="p-4 space-y-3 text-xs leading-relaxed text-ink-2">
          <p>
            SolarPower implements a hybrid diagnostic architecture combining deterministic rule fingerprinting (45% weight) with a Random Forest multi-label classifier (55% weight).
          </p>
          <p>
            High-frequency cloud variability (Stein Variability Index VI &gt; 1.30) is filtered dynamically to avoid classifying natural cloud ramps as equipment failures. Confidence scores are penalized proportionally if missing telemetry intervals require interpolation.
          </p>
        </div>
      </Card>

      {/* ── 7. Limitations & Future Scope ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card figure="07" header="7. Academic Prototype Limitations">
          <div className="p-4 space-y-2 text-xs leading-relaxed text-ink-2">
            <ul className="list-disc list-inside space-y-1.5">
              <li>Rooftop capacities are assumed for demonstration.</li>
              <li>Weather and inverter readings are generated by a simplified model.</li>
              <li>Fault labels are synthetic.</li>
              <li>The ML model requires real operational data before field deployment.</li>
              <li>The system does not directly control electrical equipment.</li>
            </ul>
          </div>
        </Card>

        <Card figure="08" header="8. Future Scope & Roadmap">
          <div className="p-4 space-y-2 text-xs leading-relaxed text-ink-2">
            <ul className="list-disc list-inside space-y-1.5">
              <li>Connect to real inverter RS-485 Modbus APIs or data loggers.</li>
              <li>Add on-campus automatic weather station (pyranometer &amp; ambient sensor).</li>
              <li>Validate and calibrate on measured campus solar generation.</li>
              <li>Add automated SMS/email alerts for campus maintenance staff.</li>
              <li>Store historical telemetry and compliance reports in a campus database.</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}
