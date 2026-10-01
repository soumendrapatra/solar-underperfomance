/**
 * Physics-based PV power model.
 *
 * Computes expected DC power using a simplified single-diode / PVsyst-style
 * approach. All inputs are SI or standard PV units.
 *
 * @param {object} params
 * @param {number} params.ghi   - Global horizontal irradiance (W/m²)
 * @param {number} params.poa   - Plane-of-array irradiance (W/m²)
 * @param {number} params.tAmb  - Ambient temperature (°C)
 * @param {number} params.ws    - Wind speed (m/s)
 * @param {number} params.pDc   - Nameplate DC capacity (Wp)
 * @param {number} [params.gamma=-0.0035] - Power temperature coefficient (/°C)
 * @param {number} [params.noct=45]       - NOCT (°C)
 * @param {number} [params.pr=0.82]       - Reference performance ratio
 * @returns {{ pExpected: number, tCell: number }}
 */
export function expectedPower({ ghi, poa, tAmb, ws, pDc, gamma = -0.0035, noct = 45, pr = 0.82 }) {
  // Cell temperature via the NOCT model (Ross correction with wind)
  const tCell = tAmb + (poa / 800) * (noct - 20) * (1 - 0.04 * ws)

  // Temperature de-rating relative to STC (25 °C)
  const tDerate = 1 + gamma * (tCell - 25)

  // Expected DC power (W)
  const pExpected = pDc * (poa / 1000) * tDerate * pr

  return { pExpected: Math.max(0, pExpected), tCell }
}

/**
 * Performance Ratio (PR) — dimensionless.
 *
 * @param {number} pActual  - Measured AC power (W)
 * @param {number} poa      - POA irradiance (W/m²)
 * @param {number} pDc      - Nameplate DC capacity (Wp)
 * @returns {number} PR in [0, 1] (clipped)
 */
export function performanceRatio(pActual, poa, pDc) {
  if (poa < 10) return NaN // avoid division by near-zero irradiance
  const pr = pActual / (pDc * (poa / 1000))
  return Math.min(Math.max(pr, 0), 1.05) // allow slight over-PR for clean sensors
}

