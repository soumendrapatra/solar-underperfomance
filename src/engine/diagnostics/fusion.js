/**
 * Hybrid Root-Cause Fusion Engine.
 * Fuses physical rule fingerprints and probabilistic ML classifications (0.45 * rule + 0.55 * ml).
 * Applies data quality penalties (imputed samples and cloud transient exclusions).
 * Supports multi-label detection (>= 0.35 threshold).
 * Routes operational/system phenomena (clipping, curtailment, sensor drift) into 'not_equipment_fault'
 * so they are never dispatched as hardware maintenance tickets.
 * Pure JavaScript, no external dependencies.
 */

// Categorization of failure modes and operational states
export const MODE_CATEGORIES = {
  // Operational and external states (NOT equipment faults)
  clipping: 'not_equipment_fault',
  inverter_clipping: 'not_equipment_fault',
  curtailment: 'not_equipment_fault',
  grid_curtailment: 'not_equipment_fault',
  sensor_drift: 'not_equipment_fault',
  pyranometer_drift: 'not_equipment_fault',

  // Genuine hardware and physical equipment faults
  string_open_circuit: 'equipment_fault',
  bypass_diode_failure: 'equipment_fault',
  string_mismatch: 'equipment_fault',
  inverter_thermal_derating: 'equipment_fault',
  partial_shading: 'equipment_fault',

  // Maintenance / cleaning operational fault
  soiling: 'equipment_fault',
}

/**
 * Assigns qualitative confidence label based on calibrated score.
 * @param {number} score - Float in [0, 1]
 * @returns {'High' | 'Medium' | 'Low'}
 */
export function getConfidenceLabel(score) {
  if (score > 0.75) return 'High'
  if (score >= 0.50) return 'Medium'
  return 'Low'
}

/**
 * Fuses rule-based fingerprint scores with ML probabilistic predictions.
 *
 * @param {Record<string, number>} ruleScores - Normalized rule confidence [0, 1]
 * @param {Record<string, number>} mlProbs - Probabilistic classifier outputs [0, 1]
 * @param {object} [qcMeta] - Data quality metadata
 * @param {number} [qcMeta.imputedPct=0] - Percentage of samples imputed (0-100)
 * @param {number} [qcMeta.transientExcludedPct=0] - Percentage of samples excluded as transients (0-100)
 * @param {object} [options]
 * @param {number} [options.threshold=0.35] - Minimum fused confidence to report
 * @param {string} [options.assetId='Bhadla Block C']
 * @returns {Array<{
 *   mode: string,
 *   confidence: number,
 *   confidenceLabel: 'High' | 'Medium' | 'Low',
 *   rawScore: number,
 *   ruleScore: number,
 *   mlProb: number,
 *   category: 'equipment_fault' | 'not_equipment_fault',
 *   isHardwareTicket: boolean,
 *   assetId: string
 * }>}
 */
export function fuseDiagnoses(ruleScores = {}, mlProbs = {}, qcMeta = {}, options = {}) {
  const {
    threshold = 0.35,
    assetId = 'Bhadla Block C',
  } = options

  const imputedPct = Math.min(100, Math.max(0, qcMeta.imputedPct || 0))
  const transientExcludedPct = Math.min(100, Math.max(0, qcMeta.transientExcludedPct || 0))

  // Data quality attenuation factor: bad/imputed/transient-heavy data attenuates final confidence
  const qualityPenalty =
    (1.0 - 0.40 * (imputedPct / 100.0)) *
    (1.0 - 0.35 * (transientExcludedPct / 100.0))

  // Collect all unique keys from both rule and ML predictions
  const allModes = new Set([
    ...Object.keys(ruleScores),
    ...Object.keys(mlProbs),
  ])

  const detectedModes = []

  for (const mode of allModes) {
    const rScore = Math.max(0, Math.min(1, ruleScores[mode] ?? 0))
    const mProb = Math.max(0, Math.min(1, mlProbs[mode] ?? 0))

    // 0.45 * ruleScore + 0.55 * mlProb
    const rawScore = 0.45 * rScore + 0.55 * mProb
    const penalizedScore = Math.round(rawScore * qualityPenalty * 1000) / 1000

    if (penalizedScore >= threshold) {
      const category = MODE_CATEGORIES[mode] || 'equipment_fault'
      const isHardwareTicket = category !== 'not_equipment_fault'

      detectedModes.push({
        mode,
        confidence: penalizedScore,
        confidenceLabel: getConfidenceLabel(penalizedScore),
        rawScore: Math.round(rawScore * 1000) / 1000,
        ruleScore: Math.round(rScore * 1000) / 1000,
        mlProb: Math.round(mProb * 1000) / 1000,
        category,
        isHardwareTicket,
        assetId: options.assetMap?.[mode] || assetId,
      })
    }
  }

  // Sort by confidence descending
  detectedModes.sort((a, b) => b.confidence - a.confidence)

  return detectedModes
}
