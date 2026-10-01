/**
 * Transient Filtering & Irradiance Variability Engine.
 * Protects against false-positive fault detection during cloud transient events.
 *
 * Implements:
 * 1. Variability Index (VI) by Stein et al. over rolling 30-minute windows
 * 2. Clear-sky index (kt* = POA / POA_clear)
 * 3. Gradient threshold (|dPOA/dt| > 150 W/m² per 5 min)
 * 4. 1-sample inverter lag compensation
 * 5. Stable vs transient sample segregation and daily exclusion metrics
 *
 * Pure JavaScript, no external dependencies.
 */

import { calculateClearSkyIrradiance } from '../simulator/weather.js'

/**
 * Computes line length of an irradiance series across consecutive intervals.
 * @param {number[]} poaSeries
 * @param {number} [dt=5.0]
 * @returns {number}
 */
function lineLength(poaSeries, dt = 5.0) {
  let length = 0
  for (let k = 1; k < poaSeries.length; k++) {
    const dPoa = poaSeries[k] - poaSeries[k - 1]
    length += Math.sqrt(dPoa * dPoa + dt * dt)
  }
  return length
}

/**
 * Filters transient cloud intervals and applies 1-sample inverter lag compensation.
 *
 * @param {object} telemetry - Telemetry container with records and plant
 * @param {object} [options]
 * @param {number} [options.viThreshold=5.0] - Variability Index threshold to flag transient
 * @param {number} [options.maxGradientPerStep=150.0] - Maximum allowable dPOA/dt (W/m² per 5m)
 * @param {number} [options.windowSteps=6] - Rolling window size (6 steps = 30 min at 5m)
 * @returns {{
 *   filteredRecords: Array<object>,
 *   dailyMetrics: Array<{ day: string, totalDaytime: number, transientSamples: number, stableSamples: number, excludedPct: number }>,
 *   overallExcludedPct: number,
 *   summary: { totalTransients: number, stableRatio: number }
 * }}
 */
export function filterTransients(telemetry, options = {}) {
  const {
    viThreshold = 5.0,
    maxGradientPerStep = 150.0,
    windowSteps = 6, // 30 minutes at 5-min intervals
    dt = 5.0,
  } = options

  const records = telemetry.records || []
  if (records.length === 0) {
    return {
      filteredRecords: [],
      dailyMetrics: [],
      overallExcludedPct: 0,
      summary: { totalTransients: 0, stableRatio: 1.0 },
    }
  }

  const plant = telemetry.plant || {}
  const tilt = plant.tilt ?? 25
  const azimuth = plant.azimuth ?? 180

  const filteredRecords = []
  const dailyTracker = {}

  let totalDaytime = 0
  let totalTransients = 0

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    const w = rec.weather || {}
    const poa = w.poaCorrected !== undefined ? w.poaCorrected : (w.poa ?? 0)
    const solarElevation = w.solarElevation ?? 0
    const solarAzimuth = w.solarAzimuth ?? 180
    const dayKey = (rec.timestamp || '').slice(0, 10) || `day-${Math.floor(i / 288)}`

    if (!dailyTracker[dayKey]) {
      dailyTracker[dayKey] = { day: dayKey, totalDaytime: 0, transientSamples: 0, stableSamples: 0 }
    }

    const isDaytime = poa > 50 && solarElevation > 2.0
    if (isDaytime) {
      dailyTracker[dayKey].totalDaytime++
      totalDaytime++
    }

    // 1. Calculate Clear-Sky POA baseline if not present
    let poaClear = w.poaClear
    if (poaClear === undefined || poaClear === null) {
      const doy = 80 // nominal day of year
      const cs = calculateClearSkyIrradiance(solarElevation, solarAzimuth, tilt, azimuth, doy)
      poaClear = cs.poa
    }

    // 2. Clear-sky index kt* = POA / POA_clear
    const clearSkyIndex = poaClear > 20 ? Math.round((poa / poaClear) * 100) / 100 : 1.0

    // 3. Rolling window for Variability Index (VI)
    const winStart = Math.max(0, i - windowSteps + 1)
    const winPoaObs = []
    const winPoaClear = []

    for (let k = winStart; k <= i; k++) {
      const kw = records[k].weather || {}
      winPoaObs.push(kw.poaCorrected !== undefined ? kw.poaCorrected : (kw.poa ?? 0))
      winPoaClear.push(kw.poaClear ?? poaClear)
    }

    let vi = 1.0
    if (winPoaObs.length >= 3 && isDaytime) {
      const lObs = lineLength(winPoaObs, dt)
      const lClear = Math.max(dt * (winPoaObs.length - 1), lineLength(winPoaClear, dt))
      vi = Math.round((lObs / lClear) * 100) / 100
    }

    // 4. Rate of change of irradiance |dPOA/dt|
    let dPoaDt = 0
    if (i > 0) {
      const prevPoa = records[i - 1].weather?.poa ?? poa
      dPoaDt = Math.round(Math.abs(poa - prevPoa) * 10) / 10
    }

    // 5. Flag Transient condition
    const isGradientTransient = dPoaDt > maxGradientPerStep
    const isViTransient = vi > viThreshold
    const isTransient = isDaytime && (isGradientTransient || isViTransient)

    if (isTransient) {
      dailyTracker[dayKey].transientSamples++
      totalTransients++
    } else if (isDaytime) {
      dailyTracker[dayKey].stableSamples++
    }

    // 6. Inverter 1-sample Lag Compensation
    // Compares pAct(t) with pExp(t) and pExp(t-1) and selects the smaller gap
    const compensatedInverters = {}
    if (rec.inverters) {
      const prevRec = i > 0 ? records[i - 1] : rec

      for (const invId in rec.inverters) {
        const inv = rec.inverters[invId]
        const prevInv = prevRec.inverters?.[invId] || inv

        const pAct = inv.pAc ?? 0
        const pExpCurrent = inv.pExp ?? pAct
        const pExpPrev = prevInv.pExp ?? pExpCurrent

        const gap0 = Math.abs(pExpCurrent - pAct)
        const gapLag = Math.abs(pExpPrev - pAct)

        const lagCompensatedGap = Math.min(gap0, gapLag)

        compensatedInverters[invId] = {
          ...inv,
          pAc: pAct,
          rawGap: Math.round(gap0 * 10) / 10,
          lagCompensatedGap: Math.round(lagCompensatedGap * 10) / 10,
          isLagArtifact: gapLag < gap0 - 15.0, // Flagged if gap drops by > 15 kW due to 1-step ramp
        }
      }
    }

    filteredRecords.push({
      ...rec,
      weather: {
        ...w,
        vi,
        dPoaDt,
        clearSkyIndex,
        isTransient,
        isStable: isDaytime && !isTransient,
      },
      inverters: compensatedInverters,
    })
  }

  // Daily metrics aggregation
  const dailyMetrics = Object.values(dailyTracker).map((d) => {
    const excludedPct = d.totalDaytime > 0
      ? Math.round((d.transientSamples / d.totalDaytime) * 1000) / 10
      : 0
    return {
      day: d.day,
      totalDaytime: d.totalDaytime,
      transientSamples: d.transientSamples,
      stableSamples: d.stableSamples,
      excludedPct,
    }
  })

  const overallExcludedPct = totalDaytime > 0
    ? Math.round((totalTransients / totalDaytime) * 1000) / 10
    : 0

  return {
    filteredRecords,
    dailyMetrics,
    overallExcludedPct,
    summary: {
      totalTransients,
      stableRatio: Math.round((1.0 - overallExcludedPct / 100) * 100) / 100,
    },
  }
}
