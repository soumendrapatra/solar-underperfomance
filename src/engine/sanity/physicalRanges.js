/**
 * Physical Range & Plausibility Validation.
 * Validates sensor and electrical telemetry against strict physical bounds:
 * - POA: 0 to 1500 W/m²
 * - tAmb: -10 to 60 °C
 * - heatsinkTemp: 0 to 110 °C
 * - pAc: 0 to 1.05 * rating (e.g. 1312.5 kW for 1250 kW rating)
 * Pure JavaScript, no external dependencies.
 */

export const PHYSICAL_BOUNDS = {
  poa: { min: 0, max: 1500, unit: 'W/m²' },
  tAmb: { min: -10, max: 60, unit: '°C' },
  heatsinkTemp: { min: 0, max: 110, unit: '°C' },
  pAcFactor: 1.05, // pAc <= 1.05 * pAcRated
}

/**
 * Validates and clamps physical bounds across all telemetry records.
 *
 * @param {Array<object>} records
 * @param {object} [options]
 * @param {number} [options.pAcRated=1250]
 * @returns {{
 *   cleanedRecords: Array<object>,
 *   issues: Array<object>
 * }}
 */
export function validatePhysicalRanges(records, options = {}) {
  const { pAcRated = 1250 } = options
  const maxPac = pAcRated * PHYSICAL_BOUNDS.pAcFactor
  const issues = []

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    const ts = rec.timestamp

    // 1. Validate POA
    if (rec.weather) {
      const poa = rec.weather.poa
      if (typeof poa === 'number' && !Number.isNaN(poa)) {
        if (poa < -5.0 || poa > PHYSICAL_BOUNDS.poa.max) {
          issues.push({
            channel: 'poa',
            assetId: 'WMS-01',
            type: 'out_of_range',
            severity: 0.9,
            value: poa,
            timestamp: ts,
            stepIndex: i,
            description: `WMS-01 POA of ${poa} W/m² exceeds physical bounds [0, 1500 W/m²]`,
          })
          rec.weather.isUnusable = true
        } else if (poa < 0) {
          // Night-time pyranometer dark-offset / thermal offset (-5 to 0 W/m²): clamp to 0
          rec.weather.poa = 0
        }
      }

      // 2. Validate tAmb
      const tAmb = rec.weather.tAmb
      if (typeof tAmb === 'number' && !Number.isNaN(tAmb)) {
        if (tAmb < PHYSICAL_BOUNDS.tAmb.min || tAmb > PHYSICAL_BOUNDS.tAmb.max) {
          issues.push({
            channel: 'tAmb',
            assetId: 'WMS-01',
            type: 'out_of_range',
            severity: 0.8,
            value: tAmb,
            timestamp: ts,
            stepIndex: i,
            description: `WMS-01 tAmb of ${tAmb} °C exceeds physical bounds [-10, 60 °C]`,
          })
          rec.weather.isUnusable = true
        }
      }
    }

    // 3. Validate Inverters
    if (rec.inverters) {
      for (const invId in rec.inverters) {
        const inv = rec.inverters[invId]

        // Heatsink temperature
        if (typeof inv.heatsinkTemp === 'number') {
          if (
            inv.heatsinkTemp < PHYSICAL_BOUNDS.heatsinkTemp.min ||
            inv.heatsinkTemp > PHYSICAL_BOUNDS.heatsinkTemp.max
          ) {
            issues.push({
              channel: 'heatsinkTemp',
              assetId: invId,
              type: 'out_of_range',
              severity: 0.85,
              value: inv.heatsinkTemp,
              timestamp: ts,
              stepIndex: i,
              description: `${invId} heatsink temperature of ${inv.heatsinkTemp} °C exceeds physical limits [0, 110 °C]`,
            })
            inv.isUnusable = true
          }
        }

        // Active Power (pAc)
        if (typeof inv.pAc === 'number') {
          if (inv.pAc < 0 || inv.pAc > maxPac) {
            issues.push({
              channel: 'pAc',
              assetId: invId,
              type: 'out_of_range',
              severity: 0.9,
              value: inv.pAc,
              timestamp: ts,
              stepIndex: i,
              description: `${invId} pAc of ${inv.pAc} kW exceeds 105% continuous rating limit (${maxPac} kW)`,
            })
            inv.isUnusable = true
          }
        }
      }
    }
  }

  return {
    cleanedRecords: records,
    issues,
  }
}
