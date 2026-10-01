/**
 * Synthetic data generator for demo mode.
 * Uses mulberry32 so every run produces identical data.
 */
import { mulberry32 } from './prng.js'

// Deterministic seed tied to "Bhadla" — do not change, keeps demo data stable
const SEED = 0xbad1a

/**
 * Generate one day of 5-minute interval telemetry for Bhadla Block C.
 *
 * @param {string} dateStr - ISO date string, e.g. "2024-03-15"
 * @param {{ faultMode?: string }} [opts]
 * @returns {object[]} Array of 288 interval records
 */
export function generateDayTelemetry(dateStr, opts = {}) {
  const rand = mulberry32(SEED)
  const { faultMode = null } = opts
  const records = []

  for (let i = 0; i < 288; i++) {
    const minuteOfDay = i * 5
    const hour = minuteOfDay / 60

    // Simple bell-curve irradiance model peaking at solar noon (~13:00 IST for Bhadla)
    const solarNoon = 13
    const poa = Math.max(0, 1050 * Math.exp(-0.5 * Math.pow((hour - solarNoon) / 3.5, 2)))
    const noise = (rand() - 0.5) * 40
    const poaMeasured = Math.max(0, poa + noise)

    const tAmb = 28 + 10 * Math.sin(((hour - 6) / 24) * Math.PI)
    const ws = 3 + rand() * 4

    // Expected power from physics model (simplified inline here for the generator)
    const tCell = tAmb + (poaMeasured / 800) * (45 - 20) * (1 - 0.04 * ws)
    const tDerate = 1 + -0.0035 * (tCell - 25)
    const pExpectedW = 12_400_000 * (poaMeasured / 1000) * tDerate * 0.82

    // Apply fault mode loss
    let lossMultiplier = 1
    if (faultMode === 'soiling' && poaMeasured > 100)       lossMultiplier = 0.88
    if (faultMode === 'string_oc' && poaMeasured > 100)     lossMultiplier = 0.875 // 1/8 strings
    if (faultMode === 'inv_thermal' && tCell > 55)          lossMultiplier = 0.93

    const pActualW = Math.max(0, pExpectedW * lossMultiplier * (0.97 + rand() * 0.04))

    records.push({
      ts: `${dateStr}T${String(Math.floor(hour)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}:00+05:30`,
      poaWm2: +poaMeasured.toFixed(1),
      tAmbC: +tAmb.toFixed(1),
      wsMs: +ws.toFixed(1),
      pExpectedW: +Math.max(0, pExpectedW).toFixed(0),
      pActualW: +pActualW.toFixed(0),
    })
  }

  return records
}
