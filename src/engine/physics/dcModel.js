/**
 * DC Array Performance Model.
 * Computes expected DC power and individual string current from irradiance and cell temperature.
 * Pure JavaScript, no external dependencies.
 */

/**
 * Calculates expected DC power for a module, string, or inverter array.
 * Formula: Pdc = Pdc0 * (POA / 1000) * (1 + gamma * (Tc - 25)) * (1 - systemLosses)
 *
 * @param {object} params
 * @param {number} params.pdc0 - Nameplate DC rating at STC (W or kW)
 * @param {number} params.poa - Plane-of-array irradiance (W/m²)
 * @param {number} params.tCell - PV cell temperature (°C)
 * @param {number} [params.gamma=-0.0035] - Maximum power temperature coefficient (/°C, e.g. -0.35 %/°C)
 * @param {number} [params.systemLosses=0.03] - DC wiring, diode, and module mismatch losses (default 3%)
 * @param {number} [params.soilingLoss=0.0] - Soiling loss derate (0 in unsoiled reference baseline)
 * @returns {{
 *   pDc: number,
 *   tempDerate: number,
 *   poaRatio: number,
 *   lossFactor: number
 * }} Expected DC power in the same units as pdc0 (W or kW)
 */
export function calculateDcPower(params) {
  const {
    pdc0,
    poa,
    tCell,
    gamma = -0.0035,
    systemLosses = 0.03,
    soilingLoss = 0.0,
  } = params

  if (poa <= 0 || pdc0 <= 0) {
    return {
      pDc: 0,
      tempDerate: 1.0,
      poaRatio: 0,
      lossFactor: 1 - systemLosses,
    }
  }

  const poaRatio = poa / 1000.0
  const tempDerate = 1.0 + gamma * (tCell - 25.0)
  const lossFactor = (1.0 - systemLosses) * (1.0 - soilingLoss)

  const pDc = Math.max(0, pdc0 * poaRatio * tempDerate * lossFactor)

  return {
    pDc: Math.round(pDc * 100) / 100,
    tempDerate: Math.round(tempDerate * 10000) / 10000,
    poaRatio: Math.round(poaRatio * 10000) / 10000,
    lossFactor: Math.round(lossFactor * 10000) / 10000,
  }
}

/**
 * Calculates expected string current.
 * Formula: Istring = Imp * (POA / 1000) * (1 + alphaIsc * (Tc - 25))
 *
 * @param {object} params
 * @param {number} params.imp - Rated module/string current at STC (A)
 * @param {number} params.poa - Plane-of-array irradiance (W/m²)
 * @param {number} params.tCell - PV cell temperature (°C)
 * @param {number} [params.alphaIsc=0.0005] - Short-circuit current temperature coefficient (/°C, +0.05 %/°C)
 * @returns {number} Expected string current in Amperes
 */
export function calculateStringCurrent(params) {
  const {
    imp,
    poa,
    tCell,
    alphaIsc = 0.0005,
  } = params

  if (poa <= 0 || imp <= 0) {
    return 0
  }

  const current = imp * (poa / 1000.0) * (1.0 + alphaIsc * (tCell - 25.0))
  return Math.max(0, Math.round(current * 100) / 100)
}

/**
 * Calculates expected string voltage at MPP.
 * Formula: Vstring = Vmp * (1 + gammaVoc * (Tc - 25))
 *
 * @param {object} params
 * @param {number} params.vmp - String rated voltage at STC (V)
 * @param {number} params.tCell - PV cell temperature (°C)
 * @param {number} [params.gammaVmp=-0.0030] - Voltage temperature coefficient (/°C)
 * @returns {number} Expected string MPP voltage in Volts
 */
export function calculateStringVoltage(params) {
  const {
    vmp,
    tCell,
    gammaVmp = -0.0030,
  } = params

  if (vmp <= 0) return 0
  const voltage = vmp * (1.0 + gammaVmp * (tCell - 25.0))
  return Math.max(0, Math.round(voltage * 10) / 10)
}
