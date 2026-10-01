/**
 * Fault fingerprinting rules.
 *
 * Each rule is a pure predicate that returns a confidence score [0, 1]
 * given a snapshot of telemetry features. Rules are intentionally simple
 * and transparent — they feed into the RF classifier as soft labels.
 *
 * Feature schema (all values normalized or in engineering units as noted):
 * @typedef {object} Features
 * @property {number} prDrop        - PR drop vs 30-day median (fractional, e.g. -0.12)
 * @property {number} stringCvIdc   - Coefficient of variation across string Idc values
 * @property {number} tInvDelta     - Inverter cabinet temp above ambient (°C)
 * @property {number} poaStdMin     - Std dev of POA irradiance over last 15 min (W/m²)
 * @property {number} iClipFraction - Fraction of 5-min intervals where Pac ≥ 0.99 × Pac_rated
 * @property {number} gridVoltDrop  - Grid voltage below lower limit (V, 0 = no drop)
 * @property {number} soilingIndex  - Soiling index from reference cell (0 = clean, 1 = heavy)
 * @property {number} openStrings   - Count of strings with Idc < 5% of median
 */

/** @param {Features} f @returns {number} */
export function ruleSoiling(f) {
  // Uniform PR drop with normal string balance and no thermal event
  if (f.stringCvIdc > 0.15 || f.tInvDelta > 15) return 0
  return Math.min(1, Math.max(0, -f.prDrop * 4) * (0.5 + 0.5 * f.soilingIndex))
}

/** @param {Features} f @returns {number} */
export function ruleStringOpenCircuit(f) {
  return f.openStrings > 0 ? Math.min(1, f.openStrings / 4) : 0
}

/** @param {Features} f @returns {number} */
export function ruleStringMismatch(f) {
  // High CV without fully open strings
  if (f.openStrings > 0) return 0
  return Math.min(1, f.stringCvIdc / 0.25)
}

/** @param {Features} f @returns {number} */
export function ruleInverterThermalDerate(f) {
  return Math.min(1, Math.max(0, (f.tInvDelta - 20) / 20))
}

/** @param {Features} f @returns {number} */
export function ruleInverterClipping(f) {
  // Clipping is normal operation — score as info, not fault
  return f.iClipFraction > 0.3 ? Math.min(1, f.iClipFraction) : 0
}

/** @param {Features} f @returns {number} */
export function ruleGridCurtailment(f) {
  return Math.min(1, f.gridVoltDrop / 20)
}

/** @param {Features} f @returns {number} */
export function ruleCloudTransient(f) {
  // High POA variability — suppress other fault scores when this is high
  return Math.min(1, f.poaStdMin / 80)
}

/**
 * Run all fingerprint rules and return scored results.
 * @param {Features} features
 * @returns {Record<string, number>}
 */
export function fingerprint(features) {
  return {
    soiling:            ruleSoiling(features),
    stringOpenCircuit:  ruleStringOpenCircuit(features),
    stringMismatch:     ruleStringMismatch(features),
    inverterThermal:    ruleInverterThermalDerate(features),
    inverterClipping:   ruleInverterClipping(features),
    gridCurtailment:    ruleGridCurtailment(features),
    cloudTransient:     ruleCloudTransient(features),
  }
}

