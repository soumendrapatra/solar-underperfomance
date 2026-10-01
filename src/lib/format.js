/**
 * Formatting utilities for engineering values.
 * All functions return plain strings — no JSX.
 */

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const INR_DEC = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** @param {number} w  Watts → "412.6 kW" */
export function formatKW(w, decimals = 1) {
  return `${(w / 1000).toFixed(decimals)} kW`
}

/** @param {number} wh  Watt-hours → "1,840.3 kWh" */
export function formatKWh(wh, decimals = 1) {
  return `${(wh / 1000).toFixed(decimals)} kWh`
}

/** @param {number} wh  Watt-hours → "1.84 MWh" */
export function formatMWh(wh, decimals = 2) {
  return `${(wh / 1_000_000).toFixed(decimals)} MWh`
}

/**
 * Signed percentage.
 * @param {number} fraction  e.g. -0.182 → "-18.2 %"
 */
export function formatPct(fraction, decimals = 1) {
  const sign = fraction >= 0 ? '+' : ''
  return `${sign}${(fraction * 100).toFixed(decimals)} %`
}

/**
 * Indian-locale currency. Defaults to INR.
 * @param {number} amount
 * @param {boolean} [withDecimals=false]
 * @returns {string}  "INR 14,820" or "INR 14,820.00"
 */
export function formatCurrency(amount, withDecimals = false) {
  return `INR ${withDecimals ? INR_DEC.format(amount) : INR.format(amount)}`
}

/**
 * Duration in seconds → "2h 14m" or "38m 05s".
 * @param {number} seconds
 */
export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

/**
 * ISO timestamp → "14:32 IST" (local India time).
 * @param {string|Date} ts
 */
export function formatTimeIST(ts) {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' IST'
}

/**
 * ISO timestamp → "15 Mar 2024" in IST.
 * @param {string|Date} ts
 */
export function formatDateIST(ts) {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
