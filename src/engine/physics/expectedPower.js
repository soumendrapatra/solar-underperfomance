/**
 * Expected Power Engine.
 * Integrates SAPM thermal modeling, DC array translation, and PVWatts inverter efficiency
 * to compute expected clean baseline generation for inverters and solar PV plants.
 * Pure JavaScript, no external dependencies.
 */

import { calculateCellTemperature } from './cellTemperature.js'
import { calculateDcPower } from './dcModel.js'
import { calculateInverterAcPower } from './inverterModel.js'

/**
 * Computes expected generation for a single inverter given a weather observation.
 *
 * @param {object} inverterSpec - Inverter model (e.g. from plantFactory: { id, pAcRated, pDcRated, ... })
 * @param {object} weatherRow - Telemetry weather row ({ poa, tAmb, wind, tModule, ... })
 * @param {object} [options]
 * @param {string} [options.irradianceKey='poa'] - Key to read POA irradiance from weatherRow
 * @param {number|null} [options.alternatePoa=null] - Explicit override POA (e.g. clear-sky or satellite)
 * @param {number} [options.systemLosses=0.03] - DC BOS, diode, wiring losses (default 3%)
 * @param {number} [options.gamma=-0.0035] - Maximum power temperature coefficient (/°C)
 * @param {number} [options.etaNom=0.985] - Nominal inverter efficiency
 * @returns {{
 *   pExp: number,
 *   pExpUnclipped: number,
 *   pDcExp: number,
 *   tCell: number,
 *   tModule: number,
 *   tempSource: string,
 *   clippingExpected: boolean,
 *   poaUsed: number
 * }} Power in kW, temperatures in °C
 */
export function expectedForInverter(inverterSpec, weatherRow, options = {}) {
  const {
    irradianceKey = 'poa',
    alternatePoa = null,
    systemLosses = 0.03,
    gamma = inverterSpec.moduleSpec?.gamma ?? -0.0035,
    etaNom = 0.985,
  } = options

  // 1. Determine which irradiance stream to use (supports sensor drift cross-checks)
  let poa = 0
  if (alternatePoa !== null && alternatePoa !== undefined) {
    poa = Math.max(0, alternatePoa)
  } else if (weatherRow[irradianceKey] !== undefined) {
    poa = Math.max(0, weatherRow[irradianceKey])
  } else {
    poa = Math.max(0, weatherRow.poa ?? weatherRow.poaWm2 ?? 0)
  }

  const tAmb = weatherRow.tAmb ?? weatherRow.tAmbC ?? 25.0
  const wind = weatherRow.wind ?? weatherRow.ws ?? weatherRow.wsMs ?? 2.0
  const measuredBom = weatherRow.measuredBom ?? weatherRow.tModule ?? null

  // 2. Compute module and cell temperature (SAPM)
  const cellResult = calculateCellTemperature({
    poa,
    tAmb,
    windSpeed: wind,
    measuredBom,
  })

  // 3. Compute DC generation
  const pDc0 = inverterSpec.pDcRated ?? (inverterSpec.pAcRated ? inverterSpec.pAcRated * 1.24 : 1550)
  const dcResult = calculateDcPower({
    pdc0: pDc0,
    poa,
    tCell: cellResult.tCell,
    gamma,
    systemLosses,
    soilingLoss: 0.0, // Expected baseline assumes 0 soiling
  })

  // 4. Compute Inverter AC generation and clipping (PVWatts)
  const pAc0 = inverterSpec.pAcRated ?? 1250
  const acResult = calculateInverterAcPower({
    pDc: dcResult.pDc,
    pAc0,
    etaNom,
  })

  return {
    pExp: acResult.pAcExpected,
    pExpUnclipped: acResult.pAcUnclipped,
    pDcExp: dcResult.pDc,
    tCell: cellResult.tCell,
    tModule: cellResult.tModule,
    tempSource: cellResult.source,
    clippingExpected: acResult.isClippingExpected,
    poaUsed: poa,
  }
}

/**
 * Computes expected generation across all weather time-series rows for a full plant.
 *
 * @param {object} plant - Full plant asset definition (from plantFactory)
 * @param {Array<object>} weatherRows - Array of weather rows (from simulator or SCADA)
 * @param {object} [options]
 * @param {string} [options.irradianceKey='poa']
 * @param {number|null} [options.alternatePoa=null]
 * @param {number} [options.systemLosses=0.03]
 * @param {number} [options.stepMinutes=5]
 * @returns {{
 *   records: Array<object>,
 *   summary: {
 *     expectedEnergyKwh: number,
 *     unclippedEnergyKwh: number,
 *     clippingLossKwh: number,
 *     clippingHours: number,
 *     peakPowerKw: number
 *   }
 * }}
 */
export function expectedForPlant(plant, weatherRows, options = {}) {
  const stepMinutes = options.stepMinutes ?? 5
  const stepHours = stepMinutes / 60.0
  const inverters = plant.inverters || [
    { id: 'INV-01', pAcRated: plant.acCapacityKw || 10000, pDcRated: plant.dcCapacityKwp || 12400 }
  ]

  let totalExpectedEnergyKwh = 0
  let totalUnclippedEnergyKwh = 0
  let totalClippingHours = 0
  let peakPowerKw = 0

  const records = []

  for (let t = 0; t < weatherRows.length; t++) {
    const w = weatherRows[t]
    let plantPexp = 0
    let plantPexpUnclipped = 0
    let anyClipping = false
    let avgTcell = 0

    const inverterOutputs = {}

    for (let i = 0; i < inverters.length; i++) {
      const inv = inverters[i]
      const out = expectedForInverter(inv, w, options)
      inverterOutputs[inv.id] = out

      plantPexp += out.pExp
      plantPexpUnclipped += out.pExpUnclipped
      if (out.clippingExpected) anyClipping = true
      avgTcell += out.tCell
    }

    avgTcell = inverters.length > 0 ? avgTcell / inverters.length : 0
    plantPexp = Math.round(plantPexp * 10) / 10
    plantPexpUnclipped = Math.round(plantPexpUnclipped * 10) / 10

    if (plantPexp > peakPowerKw) peakPowerKw = plantPexp
    if (anyClipping) totalClippingHours += stepHours

    totalExpectedEnergyKwh += plantPexp * stepHours
    totalUnclippedEnergyKwh += plantPexpUnclipped * stepHours

    records.push({
      timestamp: w.timestamp,
      stepIndex: t,
      pExp: plantPexp,
      pExpUnclipped: plantPexpUnclipped,
      tCell: Math.round(avgTcell * 10) / 10,
      clippingExpected: anyClipping,
      poaUsed: options.alternatePoa !== null ? options.alternatePoa : (w[options.irradianceKey ?? 'poa'] ?? 0),
      inverters: inverterOutputs,
    })
  }

  const clippingLossKwh = Math.max(0, totalUnclippedEnergyKwh - totalExpectedEnergyKwh)

  return {
    records,
    summary: {
      expectedEnergyKwh: Math.round(totalExpectedEnergyKwh * 10) / 10,
      unclippedEnergyKwh: Math.round(totalUnclippedEnergyKwh * 10) / 10,
      clippingLossKwh: Math.round(clippingLossKwh * 10) / 10,
      clippingHours: Math.round(totalClippingHours * 10) / 10,
      peakPowerKw: Math.round(peakPowerKw * 10) / 10,
    },
  }
}
