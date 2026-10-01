/**
 * Maintenance Priority Engine.
 * Computes risk score: score = revenueAtRiskPerDay * severityWeight * degradationRisk
 * Maps to standard O&M priority levels: P1 (Critical), P2 (High), P3 (Medium).
 * Elevates thermal derating and bypass diode / hotspot faults due to accelerated component aging.
 * Pure JavaScript, no external dependencies.
 */

// Component degradation risk multiplier
export const DEGRADATION_RISK_FACTORS = {
  // Hotspot / bypass diode short causes localized thermal burning and cell solder fatigue
  bypass_diode_failure: 2.6,

  // Thermal derating causes severe dielectric and IGBT silicon junction thermal stress
  inverter_thermal_derating: 2.4,

  // Floating Voc and loose cable risk arc faults or fuse degradation
  string_open_circuit: 1.4,

  // Mismatch creates non-uniform string heating
  string_mismatch: 1.3,

  // Shading cycles diodes between reverse and forward bias
  partial_shading: 1.2,

  // Purely optical and reversible; zero permanent degradation risk
  soiling: 1.0,

  // Non-fault operational conditions
  curtailment: 0.1,
  grid_curtailment: 0.1,
  clipping: 0.0,
  inverter_clipping: 0.0,
  pyranometer_drift: 0.5,
  sensor_drift: 0.5,
}

/**
 * Calculates priority score and maps to P1, P2, or P3.
 *
 * @param {object} params
 * @param {number} params.revenueAtRiskPerDay - Daily revenue loss in INR/day
 * @param {string} params.mode - Fault mode identifier
 * @param {number} [params.confidence=0.8] - Diagnostic confidence [0, 1]
 * @param {number} [params.severity=1.0] - Physical severity multiplier
 * @returns {{
 *   priority: 'P1' | 'P2' | 'P3',
 *   score: number,
 *   revenueAtRiskPerDay: number,
 *   degradationRisk: number,
 *   severityWeight: number,
 *   slaHours: number,
 *   rationale: string
 * }}
 */
export function calculatePriority(params) {
  const {
    revenueAtRiskPerDay,
    mode,
    confidence = 0.8,
    severity = 1.0,
  } = params

  const degradationRisk = DEGRADATION_RISK_FACTORS[mode] ?? 1.0
  const severityWeight = Math.round((0.8 + 0.4 * confidence * severity) * 100) / 100

  // score = revenueAtRiskPerDay * severityWeight * degradationRisk
  const rawScore = revenueAtRiskPerDay * severityWeight * degradationRisk
  const score = Math.round(rawScore)

  let priority = 'P3'
  let slaHours = 168 // 7 days (P3)
  let rationale = 'Routine maintenance: bundle with scheduled monthly cycle.'

  if (score >= 1200 || (degradationRisk >= 2.0 && revenueAtRiskPerDay >= 500)) {
    priority = 'P1'
    slaHours = 24 // 24 hours (P1)
    rationale = degradationRisk >= 2.0
      ? 'Critical: Active thermal stress risks permanent equipment degradation. Dispatch field technician within 24h.'
      : 'Critical: High financial revenue loss exceeds INR 1,200/day. Immediate dispatch required.'
  } else if (score >= 400 || (degradationRisk >= 2.0 && revenueAtRiskPerDay >= 150)) {
    priority = 'P2'
    slaHours = 72 // 3 days (P2)
    rationale = 'High priority: Substantial energy loss. Inspect within 3 business days.'
  }

  return {
    priority,
    score,
    revenueAtRiskPerDay: Math.round(revenueAtRiskPerDay),
    degradationRisk,
    severityWeight,
    slaHours,
    rationale,
  }
}
