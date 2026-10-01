/**
 * Sandia Array Performance Model (SAPM) for PV Cell and Module Temperature.
 * Reference: King, D.L., Boyson, W.E., Kratochvil, J.A. (2004).
 * "Photovoltaic Array Performance Model", Sandia Report SAND2004-5235.
 * Pure JavaScript, no external dependencies.
 */

// SAPM empirically fitted coefficients for Open-rack Glass/Cell/Polymer backsheet
export const SAPM_OPEN_RACK_GLASS_POLYMER = {
  a: -3.56,
  b: -0.075,
  deltaT: 3.0, // Temperature difference between cell and module back surface at 1000 W/m² (°C)
}

/**
 * Checks whether a measured back-of-module temperature reading is physically plausible.
 * @param {number} tBom - Measured back-of-module temperature in °C
 * @param {number} tAmb - Ambient air temperature in °C
 * @param {number} poa - Plane-of-array irradiance in W/m²
 * @returns {boolean} True if measurement passes physical sanity bounds
 */
export function isMeasuredBomValid(tBom, tAmb, poa) {
  if (typeof tBom !== 'number' || Number.isNaN(tBom) || !Number.isFinite(tBom)) {
    return false
  }

  // 1. Extreme absolute sensor limits (-15 °C to +95 °C)
  if (tBom < -15 || tBom > 95) {
    return false
  }

  // 2. Daytime physical consistency: module cannot be substantially colder than ambient under high irradiance
  if (poa > 100 && tBom < tAmb - 4.0) {
    return false
  }

  // 3. Module cannot exceed ambient by more than 55 °C under normal conditions
  if (tBom > tAmb + 55.0) {
    return false
  }

  return true
}

/**
 * Calculates module back-surface temperature (Tm) and internal PV cell temperature (Tc).
 * Prioritizes validated measured back-of-module sensor data when available.
 *
 * @param {object} params
 * @param {number} params.poa - Plane-of-array irradiance (W/m²)
 * @param {number} params.tAmb - Ambient air temperature (°C)
 * @param {number} [params.windSpeed=2.0] - Wind speed at 10m height (m/s)
 * @param {number|null} [params.measuredBom=null] - Measured back-of-module sensor reading (°C)
 * @param {object} [params.coefficients=SAPM_OPEN_RACK_GLASS_POLYMER] - SAPM coefficients
 * @returns {{
 *   tCell: number,
 *   tModule: number,
 *   source: 'measured_bom' | 'sapm_modeled',
 *   deltaT: number
 * }} Temperatures in °C
 */
export function calculateCellTemperature(params) {
  const {
    poa,
    tAmb,
    windSpeed = 2.0,
    measuredBom = null,
    coefficients = SAPM_OPEN_RACK_GLASS_POLYMER,
  } = params

  const { a, b, deltaT } = coefficients

  // Night / near-zero irradiance condition
  if (poa <= 2.0) {
    return {
      tCell: Math.round(tAmb * 10) / 10,
      tModule: Math.round(tAmb * 10) / 10,
      source: 'sapm_modeled',
      deltaT: 0,
    }
  }

  // Check if measured back-of-module temperature is present and valid
  const hasValidMeasured = isMeasuredBomValid(measuredBom, tAmb, poa)

  let tModule = 0
  let source = 'sapm_modeled'

  if (hasValidMeasured) {
    tModule = measuredBom
    source = 'measured_bom'
  } else {
    // SAPM formula: Tm = E * exp(a + b * WS) + Ta
    const ws = Math.max(0, windSpeed)
    tModule = poa * Math.exp(a + b * ws) + tAmb
    source = 'sapm_modeled'
  }

  // Cell temperature: Tc = Tm + (E / 1000) * deltaT
  const cellDelta = (poa / 1000) * deltaT
  const tCell = tModule + cellDelta

  return {
    tCell: Math.round(tCell * 100) / 100,
    tModule: Math.round(tModule * 100) / 100,
    source,
    deltaT: Math.round(cellDelta * 100) / 100,
  }
}
