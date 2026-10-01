/**
 * Yield Gap Analysis Engine.
 * Quantifies generation loss: deltaP = pExp - pAct, lossPct = deltaP / pExp,
 * daily Performance Ratio (PR), and integral lost energy (kWh) and revenue loss (INR).
 * Ignores dawn/dusk samples (POA < 100 W/m²) and samples marked unusable by sanity.
 * Pure JavaScript, no external dependencies.
 */

import { expectedForInverter } from '../physics/expectedPower.js'

/**
 * Computes yield gap analysis per inverter and across the full plant.
 *
 * @param {object} telemetry - Telemetry container (cleaned from sanity)
 * @param {object} [options]
 * @param {number} [options.minPoa=100.0] - Minimum POA irradiance threshold (W/m²)
 * @param {number} [options.stepMinutes=5] - Sample interval in minutes
 * @param {number} [options.tariffInrPerKwh=2.48] - PPA tariff rate
 * @returns {{
 *   timeSeries: Array<object>,
 *   dailyAggregates: Array<{
 *     day: string,
 *     actualEnergyKwh: number,
 *     expectedEnergyKwh: number,
 *     lostEnergyKwh: number,
 *     revenueLossInr: number,
 *     pr: number,
 *     validSamples: number,
 *     ignoredSamples: number
 *   }>,
 *   summary: {
 *     totalActualEnergyKwh: number,
 *     totalExpectedEnergyKwh: number,
 *     totalLostEnergyKwh: number,
 *     totalRevenueLossInr: number,
 *     plantPr: number
 *   }
 * }}
 */
export function calculateYieldGap(telemetry, options = {}) {
  const {
    minPoa = 100.0,
    stepMinutes = 5,
    tariffInrPerKwh = telemetry.plant?.tariffInrPerKwh ?? 2.48,
  } = options

  const stepHours = stepMinutes / 60.0
  const records = telemetry.records || []
  const plant = telemetry.plant || {}
  const inverters = plant.inverters || []

  const timeSeries = []
  const dailyBuckets = {}

  let totalActKwh = 0
  let totalExpKwh = 0
  let totalLostKwh = 0

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    const w = rec.weather || {}
    const poa = w.poaCorrected !== undefined ? w.poaCorrected : (w.poa ?? 0)
    const isUnusable = w.isUnusable === true || rec.isUnusable === true

    // Ignore dawn/dusk noise when POA < 100 W/m² or sample marked unusable
    const isIgnored = poa < minPoa || isUnusable

    let plantPexp = 0
    let plantPact = 0
    const invGaps = {}

    if (!isIgnored && rec.inverters) {
      for (let j = 0; j < inverters.length; j++) {
        const invSpec = inverters[j]
        const invData = rec.inverters[invSpec.id]
        if (!invData) continue

        // Compute or retrieve expected power
        const expResult = expectedForInverter(invSpec, w, { alternatePoa: poa })
        const pExp = expResult.pExp
        const pAct = invData.pAc ?? 0
        const deltaP = Math.max(0, pExp - pAct)
        const lossPct = pExp > 10 ? deltaP / pExp : 0

        invGaps[invSpec.id] = {
          pExp: Math.round(pExp * 10) / 10,
          pAct: Math.round(pAct * 10) / 10,
          deltaP: Math.round(deltaP * 10) / 10,
          lossPct: Math.round(lossPct * 1000) / 1000,
          isClippingExpected: expResult.clippingExpected,
        }

        plantPexp += pExp
        plantPact += pAct
      }
    }

    const plantDeltaP = Math.max(0, plantPexp - plantPact)
    const plantLossPct = plantPexp > 50 ? plantDeltaP / plantPexp : 0

    // Integral of positive deltaP over time is lost energy (kWh)
    const lostKwh = isIgnored ? 0 : plantDeltaP * stepHours
    const actKwh = isIgnored ? 0 : plantPact * stepHours
    const expKwh = isIgnored ? 0 : plantPexp * stepHours

    totalLostKwh += lostKwh
    totalActKwh += actKwh
    totalExpKwh += expKwh

    const dayKey = (rec.timestamp || '').slice(0, 10) || `day-${Math.floor(i / 288)}`
    if (!dailyBuckets[dayKey]) {
      dailyBuckets[dayKey] = {
        day: dayKey,
        actualEnergyKwh: 0,
        expectedEnergyKwh: 0,
        lostEnergyKwh: 0,
        validSamples: 0,
        ignoredSamples: 0,
      }
    }

    if (isIgnored) {
      dailyBuckets[dayKey].ignoredSamples++
    } else {
      dailyBuckets[dayKey].validSamples++
      dailyBuckets[dayKey].actualEnergyKwh += actKwh
      dailyBuckets[dayKey].expectedEnergyKwh += expKwh
      dailyBuckets[dayKey].lostEnergyKwh += lostKwh
    }

    timeSeries.push({
      timestamp: rec.timestamp,
      stepIndex: i,
      poa,
      isIgnored,
      ignoreReason: isUnusable ? 'sanity_unusable' : poa < minPoa ? 'poa_below_100' : null,
      plantPexp: Math.round(plantPexp * 10) / 10,
      plantPact: Math.round(plantPact * 10) / 10,
      plantDeltaP: Math.round(plantDeltaP * 10) / 10,
      plantLossPct: Math.round(plantLossPct * 1000) / 1000,
      lostKwh: Math.round(lostKwh * 100) / 100,
      inverters: invGaps,
    })
  }

  // Calculate daily aggregates & PR
  const dailyAggregates = Object.values(dailyBuckets).map((b) => {
    const pr = b.expectedEnergyKwh > 0 ? b.actualEnergyKwh / b.expectedEnergyKwh : 0
    const revLoss = b.lostEnergyKwh * tariffInrPerKwh
    return {
      day: b.day,
      actualEnergyKwh: Math.round(b.actualEnergyKwh * 10) / 10,
      expectedEnergyKwh: Math.round(b.expectedEnergyKwh * 10) / 10,
      lostEnergyKwh: Math.round(b.lostEnergyKwh * 10) / 10,
      revenueLossInr: Math.round(revLoss),
      pr: Math.round(pr * 1000) / 1000,
      validSamples: b.validSamples,
      ignoredSamples: b.ignoredSamples,
    }
  })

  const overallPr = totalExpKwh > 0 ? totalActKwh / totalExpKwh : 0
  const totalRevenueLossInr = Math.round(totalLostKwh * tariffInrPerKwh)

  return {
    timeSeries,
    dailyAggregates,
    summary: {
      totalActualEnergyKwh: Math.round(totalActKwh * 10) / 10,
      totalExpectedEnergyKwh: Math.round(totalExpKwh * 10) / 10,
      totalLostEnergyKwh: Math.round(totalLostKwh * 10) / 10,
      totalRevenueLossInr,
      plantPr: Math.round(overallPr * 1000) / 1000,
    },
  }
}
