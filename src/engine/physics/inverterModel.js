/**
 * PVWatts Inverter Model.
 * Computes inverter AC power output with empirical part-load efficiency curve and rated capacity clipping.
 * Reference: Dobos, A. P. (2014). "PVWatts Version 5 Manual", NREL/TP-5200-60272.
 * Pure JavaScript, no external dependencies.
 */

// Reference constant: -0.0162 - 0.0059 + 0.9858 = 0.9637
const ETA_REF = 0.9637

/**
 * Calculates expected AC power output from input DC power using the PVWatts part-load model.
 *
 * @param {object} params
 * @param {number} params.pDc - Input DC power (W or kW)
 * @param {number} params.pAc0 - Inverter rated continuous AC capacity (W or kW, same unit as pDc)
 * @param {number} [params.etaNom=0.985] - Nominal maximum inverter efficiency (default 0.985 / 98.5%)
 * @param {number} [params.pStandbyFraction=0.005] - Standby tare loss fraction below which Pac = 0
 * @returns {{
 *   pAcExpected: number,
 *   pAcUnclipped: number,
 *   isClippingExpected: boolean,
 *   efficiency: number,
 *   loadRatio: number
 * }} All powers in the same units as pDc and pAc0
 */
export function calculateInverterAcPower(params) {
  const {
    pDc,
    pAc0,
    etaNom = 0.985,
    pStandbyFraction = 0.005,
  } = params

  if (pDc <= 0 || pAc0 <= 0) {
    return {
      pAcExpected: 0,
      pAcUnclipped: 0,
      isClippingExpected: false,
      efficiency: 0,
      loadRatio: 0,
    }
  }

  // Rated DC input corresponding to nominal AC output
  const pDc0 = pAc0 / etaNom
  const loadRatio = pDc / pDc0

  // Below standby/tare power threshold, inverter does not export
  if (loadRatio <= pStandbyFraction) {
    return {
      pAcExpected: 0,
      pAcUnclipped: 0,
      isClippingExpected: false,
      efficiency: 0,
      loadRatio: Math.round(loadRatio * 1000) / 1000,
    }
  }

  // PVWatts part-load efficiency polynomial
  // eta = (etaNom / etaRef) * (-0.0162 * zeta - 0.0059 / zeta + 0.9858)
  const partLoadPoly = -0.0162 * loadRatio - 0.0059 / loadRatio + 0.9858
  const efficiency = Math.max(0, Math.min(1.0, (etaNom / ETA_REF) * partLoadPoly))

  // Unclipped AC generation
  const pAcUnclipped = pDc * efficiency

  // Clip at rated continuous AC capacity Pac0
  const isClippingExpected = pAcUnclipped >= pAc0
  const pAcExpected = Math.min(pAc0, Math.max(0, pAcUnclipped))

  return {
    pAcExpected: Math.round(pAcExpected * 10) / 10,
    pAcUnclipped: Math.round(pAcUnclipped * 10) / 10,
    isClippingExpected,
    efficiency: Math.round(efficiency * 10000) / 10000,
    loadRatio: Math.round(loadRatio * 1000) / 1000,
  }
}
