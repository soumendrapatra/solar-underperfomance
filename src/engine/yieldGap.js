/**
 * Yield gap decomposition — splits total energy loss into labelled causes.
 *
 * Each "bucket" represents one loss category. The sum of all loss buckets
 * should equal (expectedEnergy - actualEnergy).
 *
 * @typedef {object} GapBucket
 * @property {string} label   - Short display name
 * @property {number} energyWh - Energy loss attributed to this cause (Wh, positive = loss)
 * @property {string} faultCode - Internal fault code
 *
 * @param {number} expectedWh
 * @param {number} actualWh
 * @param {GapBucket[]} buckets
 * @returns {{ total: number, buckets: GapBucket[], unaccounted: number }}
 */
export function decomposeYieldGap(expectedWh, actualWh, buckets) {
  const total = expectedWh - actualWh
  const attributed = buckets.reduce((s, b) => s + b.energyWh, 0)
  const unaccounted = total - attributed
  return { total, buckets, unaccounted }
}

