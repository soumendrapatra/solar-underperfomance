/**
 * Clean baseline telemetry generator for solar PV plants.
 * Computes deterministic electrical operating points for inverters, MPPTs, SCBs, and strings
 * from weather inputs and plant asset hierarchy.
 * Pure JavaScript, no external dependencies.
 */

import { mulberry32, gaussian, between } from './rng.js'

/**
 * Calculates string MPP voltage given cell/module temperature and fault state.
 * @param {object} moduleSpec
 * @param {number} tModule
 * @param {number} modulesCount
 * @returns {number} String MPP voltage in Volts
 */
export function calculateStringVmp(moduleSpec, tModule, modulesCount = 28) {
  const gamma = moduleSpec.gamma ?? -0.0035
  const tempDelta = tModule - 25
  const vmpModule = moduleSpec.vmp * (1 + gamma * tempDelta)
  return Math.max(0, modulesCount * vmpModule)
}

/**
 * Calculates string open-circuit voltage given cell/module temperature.
 * @param {object} moduleSpec
 * @param {number} tModule
 * @param {number} modulesCount
 * @returns {number} String Voc in Volts
 */
export function calculateStringVoc(moduleSpec, tModule, modulesCount = 28) {
  const gammaVoc = moduleSpec.gammaVoc ?? -0.0028
  const tempDelta = tModule - 25
  const vocModule = moduleSpec.voc * (1 + gammaVoc * tempDelta)
  return Math.max(0, modulesCount * vocModule)
}

/**
 * Calculates clean baseline string current at a given POA irradiance and temperature.
 * @param {object} moduleSpec
 * @param {number} poa
 * @param {number} tModule
 * @returns {number} Current in Amperes
 */
export function calculateStringImp(moduleSpec, poa, tModule) {
  if (poa <= 2) return 0
  const alphaIsc = moduleSpec.alphaIsc ?? 0.0005
  const tempDelta = tModule - 25
  const imp = moduleSpec.imp * (poa / 1000) * (1 + alphaIsc * tempDelta)
  return Math.max(0, imp)
}

/**
 * Generates clean baseline telemetry time-series for a plant across weather rows.
 * @param {object} plant - Plant definition from plantFactory
 * @param {Array<object>} weatherRows - Weather time-series from weather.js
 * @param {object} [options]
 * @param {boolean} [options.includeStrings=true] - Whether to generate individual string currents
 * @param {number} [options.seed=42] - PRNG seed for electrical measurement noise
 * @returns {object} Clean simulation container with plant, weather, records, and groundTruth
 */
export function generateCleanTelemetry(plant, weatherRows, options = {}) {
  const { includeStrings = true, seed = 42 } = options
  const rand = mulberry32(seed)
  const moduleSpec = plant.moduleSpec
  const invCount = plant.inverters.length

  // Inverter efficiency curve parameters (CEC/Sandia-like model)
  const etaMax = 0.984

  // Scaling factor from nominal 48 monitored strings to inverter DC rated capacity (1550 kWp)
  // 48 strings * 28 modules * 545 Wp = 732.48 kWp -> scale ratio = 1550 / 732.48 ~ 2.116
  const stringsPnomSum = 48 * 28 * (moduleSpec.pNom / 1000)
  const dcScaleFactor = (plant.inverters[0]?.pDcRated ?? 1550) / stringsPnomSum

  const records = []

  for (let tIdx = 0; tIdx < weatherRows.length; tIdx++) {
    const w = weatherRows[tIdx]
    const { timestamp, poa, tAmb, tModule, solarElevation } = w
    const isDay = poa > 5 && solarElevation > 0.5

    // Base string Vmp & Imp at this timestamp
    const baseVmp = calculateStringVmp(moduleSpec, tModule, 28)
    const baseVoc = calculateStringVoc(moduleSpec, tModule, 28)
    const baseImp = calculateStringImp(moduleSpec, poa, tModule)

    const invertersTelemetry = {}

    for (let invIdx = 0; invIdx < invCount; invIdx++) {
      const inv = plant.inverters[invIdx]
      const invId = inv.id

      // Small intrinsic inverter-to-inverter calibration variance (+- 0.8%)
      const invCalibration = 1.0 + (gaussian(0, 0.004, rand))

      const mpptsTelemetry = []
      const scbsTelemetry = {}
      let totalInvPdc = 0

      // Process each MPPT
      for (let mIdx = 0; mIdx < inv.mppts.length; mIdx++) {
        const mppt = inv.mppts[mIdx]
        let mpptCurrentSum = 0
        let mpptVoltageSum = 0
        let mpptScbCount = 0

        for (let sIdx = 0; sIdx < mppt.combinerBoxes.length; sIdx++) {
          const scb = mppt.combinerBoxes[sIdx]
          const scbId = scb.id
          const stringCurrents = []
          let scbCurrentSum = 0

          for (let strIdx = 0; strIdx < scb.strings.length; strIdx++) {
            let strCurrent = 0
            if (isDay) {
              // String-level manufacturing / mismatch noise (+- 1.5%)
              const strNoise = 1.0 + gaussian(0, 0.012, rand)
              strCurrent = Math.max(0, baseImp * invCalibration * strNoise)
            }
            strCurrent = Math.round(strCurrent * 100) / 100

            if (includeStrings) {
              stringCurrents.push(strCurrent)
            }
            scbCurrentSum += strCurrent
          }

          scbsTelemetry[scbId] = {
            id: scbId,
            fullId: `${invId}/${scbId}`,
            iDc: Math.round(scbCurrentSum * 10) / 10,
            strings: stringCurrents,
          }

          mpptCurrentSum += scbCurrentSum
          mpptVoltageSum += isDay ? baseVmp + gaussian(0, 2.0, rand) : 0
          mpptScbCount++
        }

        const avgMpptVoltage = mpptScbCount > 0 ? mpptVoltageSum / mpptScbCount : 0
        // Scaled DC power for the MPPT
        const mpptPdc = isDay
          ? (avgMpptVoltage * (mpptCurrentSum * dcScaleFactor)) / 1000
          : 0

        totalInvPdc += mpptPdc

        mpptsTelemetry.push({
          id: mppt.id,
          vDc: Math.round(avgMpptVoltage * 10) / 10,
          iDc: Math.round(mpptCurrentSum * dcScaleFactor * 10) / 10,
          pDc: Math.round(mpptPdc * 10) / 10,
        })
      }

      // Inverter AC output & clipping determination
      let pAc = 0
      let status = 'OFFLINE'
      let isClipping = false

      if (isDay && totalInvPdc > 5) {
        // Efficiency curve: drop slightly at light load, peak around 50-80%
        const loadRatio = Math.min(1.2, totalInvPdc / inv.pDcRated)
        const eff = etaMax * (1 - 0.015 * Math.pow(1 - loadRatio, 2))
        const pAcRaw = totalInvPdc * eff

        if (pAcRaw >= inv.pAcRated) {
          // Inverter clipping (natural at rated 1250 kWac)
          pAc = inv.pAcRated
          status = 'CLIPPING'
          isClipping = true
        } else {
          pAc = pAcRaw
          status = 'NORMAL'
        }
      }

      // Reactive power (qAc): slight power factor variance (+- 15 kVAR)
      const qAc = isDay ? Math.round(gaussian(0, 4.0, rand) * 10) / 10 : 0

      // Heatsink temperature: normal delta ~18°C above ambient + load rise
      const loadHeat = (pAc / inv.pAcRated) * 14
      const heatsinkTemp = Math.round((tAmb + 18 + loadHeat + gaussian(0, 0.4, rand)) * 10) / 10

      invertersTelemetry[invId] = {
        id: invId,
        pAc: Math.round(pAc * 10) / 10,
        qAc,
        pDc: Math.round(totalInvPdc * 10) / 10,
        mppts: mpptsTelemetry,
        scbs: scbsTelemetry,
        heatsinkTemp,
        gridSetpointPct: 100,
        status,
        isClipping,
        baseVoc: Math.round(baseVoc * 10) / 10,
        baseVmp: Math.round(baseVmp * 10) / 10,
      }
    }

    records.push({
      timestamp,
      stepIndex: tIdx,
      weather: w,
      inverters: invertersTelemetry,
    })
  }

  return {
    plant,
    weather: weatherRows,
    records,
    labels: [], // Ground-truth labels added by fault injectors
    metadata: {
      generatedAt: new Date().toISOString(),
      stepMinutes: 5,
      days: Math.round(weatherRows.length / 288),
      seed,
    },
  }
}
