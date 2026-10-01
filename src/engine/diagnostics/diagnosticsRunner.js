/**
 * Integrated Diagnostics Runner.
 * Coordinates data cleaning, transient filtering, yield gap calculation,
 * rule-based candidate detection, and persistence gating into confirmed actionable work orders.
 * Pure JavaScript, no external dependencies.
 */

import { generateSanityReport } from '../sanity/sanityReport.js'
import { filterTransients } from './transientFilter.js'
import { calculateYieldGap } from './yieldGap.js'
import { evaluatePersistence } from './persistenceGate.js'

/**
 * Runs end-to-end diagnosis pipeline on a solar PV dataset.
 *
 * @param {object} telemetry - Raw or simulated telemetry container
 * @param {object} [options]
 * @returns {{
 *   sanityReport: object,
 *   transientMetrics: object,
 *   yieldGap: object,
 *   candidateFaults: Array<object>,
 *   raisedFaults: Array<object>,
 *   isCleanRun: boolean
 * }}
 */
export function runDiagnostics(telemetry, options = {}) {
  // 1. Data Quality & Sanity Layer
  const sanityReport = generateSanityReport(telemetry, options)
  const cleanedTelemetry = sanityReport.cleanedTelemetry

  // 2. Transient Filtering & Lag Compensation Layer
  const transientResult = filterTransients(cleanedTelemetry, options)
  const filteredRecords = transientResult.filteredRecords

  // 3. Yield Gap & Energy Loss Layer
  const yieldGap = calculateYieldGap({ ...cleanedTelemetry, records: filteredRecords }, options)

  // 4. Candidate Fault Extraction (Scanning stable daylight intervals)
  const candidateMap = {}

  for (let i = 0; i < filteredRecords.length; i++) {
    const rec = filteredRecords[i]
    const w = rec.weather || {}

    // Only scan stable, usable daytime intervals
    if (!w.isStable || w.isUnusable || (w.poa && w.poa < 150)) {
      continue
    }

    if (!rec.inverters) continue

    for (const invId in rec.inverters) {
      const inv = rec.inverters[invId]

      // Check Inverter Thermal Derating
      if (inv.status === 'DERATED' || (inv.heatsinkTemp > 72 && inv.pAc <= 1250 * 0.85)) {
        const key = `inverter_derate-${invId}`
        if (!candidateMap[key]) {
          candidateMap[key] = {
            id: key,
            faultType: 'inverter_thermal_derating',
            assetId: invId,
            instances: [],
          }
        }
        candidateMap[key].instances.push({ stepIndex: i, timestamp: rec.timestamp })
      }

      // Check Grid Curtailment
      if (inv.gridSetpointPct !== undefined && inv.gridSetpointPct < 99) {
        const key = `curtailment-${invId}`
        if (!candidateMap[key]) {
          candidateMap[key] = {
            id: key,
            faultType: 'grid_curtailment',
            assetId: invId,
            instances: [],
          }
        }
        candidateMap[key].instances.push({ stepIndex: i, timestamp: rec.timestamp })
      }

      // Check Combiner Boxes & Strings
      if (inv.scbs) {
        for (const scbId in inv.scbs) {
          const scb = inv.scbs[scbId]

          // Check Bypass Diode Failure
          if (scb.failedBypassDiodes && scb.failedBypassDiodes > 0) {
            const key = `diode-${invId}-${scbId}`
            if (!candidateMap[key]) {
              candidateMap[key] = {
                id: key,
                faultType: 'bypass_diode_failure',
                assetId: `${invId}/${scbId}`,
                instances: [],
              }
            }
            candidateMap[key].instances.push({ stepIndex: i, timestamp: rec.timestamp })
          }

          // Check String Currents
          if (scb.strings && scb.strings.length > 0) {
            const meanCurrent = scb.strings.reduce((s, c) => s + c, 0) / scb.strings.length

            if (meanCurrent > 4.0) {
              for (let s = 0; s < scb.strings.length; s++) {
                const iStr = scb.strings[s]
                const stringId = `S${String(s + 1).padStart(2, '0')}`
                const fullStringId = `${invId}/${scbId}/${stringId}`

                // String Open Circuit: current < 0.3 A while combiner mean is healthy (> 4 A)
                if (iStr < 0.3) {
                  const key = `open_circuit-${fullStringId}`
                  if (!candidateMap[key]) {
                    candidateMap[key] = {
                      id: key,
                      faultType: 'string_open_circuit',
                      assetId: fullStringId,
                      instances: [],
                    }
                  }
                  candidateMap[key].instances.push({
                    stepIndex: i,
                    timestamp: rec.timestamp,
                    current: iStr,
                    meanCurrent,
                  })
                }
              }
            }
          }
        }
      }
    }
  }

  const candidateList = Object.values(candidateMap)

  // 5. Temporal Persistence Gating
  const raisedFaults = evaluatePersistence(candidateList, filteredRecords, options)

  return {
    sanityReport,
    transientMetrics: {
      overallExcludedPct: transientResult.overallExcludedPct,
      dailyMetrics: transientResult.dailyMetrics,
    },
    yieldGap,
    candidateFaults: candidateList,
    raisedFaults,
    isCleanRun: raisedFaults.length === 0,
  }
}
