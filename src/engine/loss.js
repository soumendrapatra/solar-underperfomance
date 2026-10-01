/**
 * Financial loss quantification.
 *
 * @param {number} lostEnergyWh  - Energy not generated (Wh)
 * @param {number} tariffPerKwh  - Revenue tariff (INR/kWh)
 * @returns {{ lostEnergyKwh: number, revenueLossInr: number }}
 */
export function quantifyLoss(lostEnergyWh, tariffPerKwh) {
  const lostEnergyKwh = lostEnergyWh / 1000
  const revenueLossInr = lostEnergyKwh * tariffPerKwh
  return { lostEnergyKwh, revenueLossInr }
}

/**
 * Format a number for display with tabular mono style.
 * Always includes the unit. Used in JSDoc @example blocks for reference.
 *
 * @param {number} value
 * @param {string} unit
 * @param {number} [decimals=1]
 * @returns {string} e.g. "412.6 kW" or "INR 14,820"
 */
export function fmt(value, unit, decimals = 1) {
  const n = value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return unit.startsWith('INR') ? `INR ${n}` : `${n} ${unit}`
}

