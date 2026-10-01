/**
 * Sanity & Data Health Aggregation Engine.
 * Aggregates stuck value detection, dropout analysis, physical range bounds,
 * and pyranometer drift assessment into a unified per-plant, per-channel health report (0-100).
 * Produces clean, gap-filled, and drift-corrected telemetry for downstream diagnostics.
 * Pure JavaScript, no external dependencies.
 */

import { scanTelemetryForStuckValues } from './stuckValues.js'
import { fillMissingTimestamps, cleanChannelDropouts } from './dropouts.js'
import { validatePhysicalRanges } from './physicalRanges.js'
import { analyzePyranometerDrift } from './pyranometerDrift.js'

/**
 * Runs the full data sanity and QC pipeline on raw telemetry.
 *
 * @param {object} telemetry - Raw simulation or SCADA telemetry container
 * @param {object} [options]
 * @returns {{
 *   overallHealthScore: number,
 *   channelScores: Record<string, number>,
 *   issues: Array<{
 *     channel: string,
 *     assetId: string,
 *     type: 'stuck' | 'dropout' | 'drift' | 'out_of_range',
 *     window: { start: string, end: string },
 *     severity: number,
 *     description: string
 *   }>,
 *   cleanedTelemetry: object,
 *   summary: {
 *     totalSamples: number,
 *     imputedSamples: number,
 *     unusableSamples: number,
 *     completenessPct: number,
 *     driftDetected: boolean
 *   }
 * }}
 */
export function generateSanityReport(telemetry, options = {}) {
  const rawRecords = telemetry.records || []
  if (rawRecords.length === 0) {
    return {
      overallHealthScore: 100,
      channelScores: { poa: 100, tAmb: 100, pAc: 100, heatsink: 100 },
      issues: [],
      cleanedTelemetry: telemetry,
      summary: {
        totalSamples: 0,
        imputedSamples: 0,
        unusableSamples: 0,
        completenessPct: 100,
        driftDetected: false,
      },
    }
  }

  const allIssues = []

  // Step 1: Uniform timestamp spacing / missing rows
  let records = fillMissingTimestamps(rawRecords, options.stepMinutes || 5)

  // Step 2: Physical range checks
  const rangeResult = validatePhysicalRanges(records, options)
  records = rangeResult.cleanedRecords
  for (const issue of rangeResult.issues) {
    allIssues.push({
      channel: issue.channel,
      assetId: issue.assetId,
      type: 'out_of_range',
      window: { start: issue.timestamp, end: issue.timestamp },
      severity: issue.severity,
      description: issue.description,
    })
  }

  // Step 3: Stuck sensor value detection
  const stuckIssues = scanTelemetryForStuckValues({ ...telemetry, records })
  for (const s of stuckIssues) {
    allIssues.push({
      channel: s.channel,
      assetId: s.assetId,
      type: 'stuck',
      window: { start: s.startTime, end: s.endTime },
      severity: s.severity,
      description: s.description,
    })
  }

  // Step 4: Dropouts & Imputation for POA and tAmb
  const poaDropouts = cleanChannelDropouts(
    records,
    (r) => r.weather?.poa,
    (r, val, meta) => {
      if (r.weather) {
        if (meta.isImputed) r.weather.isImputed = true
        if (meta.isUnusable) r.weather.isUnusable = true
        if (val !== null) r.weather.poa = val
      }
    },
    { channel: 'poa', assetId: 'WMS-01' }
  )

  for (const d of poaDropouts.issues) {
    allIssues.push({
      channel: d.channel,
      assetId: d.assetId,
      type: 'dropout',
      window: { start: d.startTime, end: d.endTime },
      severity: d.severity,
      description: d.description,
    })
  }

  // Step 5: Pyranometer Drift Evaluation
  const driftResult = analyzePyranometerDrift({ ...telemetry, records }, options)
  records = driftResult.correctedRecords
  if (driftResult.issue) {
    allIssues.push({
      channel: driftResult.issue.channel,
      assetId: driftResult.issue.assetId,
      type: 'drift',
      window: {
        start: driftResult.firstDriftDate || records[0]?.timestamp,
        end: records[records.length - 1]?.timestamp,
      },
      severity: driftResult.issue.severity,
      description: driftResult.issue.description,
    })
  }

  // Step 6: Compute Channel & Plant Health Scores (0-100)
  let poaPenalty = 0
  let tAmbPenalty = 0
  let pAcPenalty = 0
  let heatsinkPenalty = 0

  let imputedCount = 0
  let unusableCount = 0

  for (const r of records) {
    if (r.weather?.isImputed) imputedCount++
    if (r.weather?.isUnusable) unusableCount++
  }

  for (const issue of allIssues) {
    const p = issue.severity * 20
    switch (issue.channel) {
      case 'poa':
        poaPenalty = Math.min(60, poaPenalty + p)
        break
      case 'tAmb':
        tAmbPenalty = Math.min(50, tAmbPenalty + p)
        break
      case 'pAc':
        pAcPenalty = Math.min(60, pAcPenalty + p)
        break
      case 'heatsinkTemp':
        heatsinkPenalty = Math.min(40, heatsinkPenalty + p)
        break
      default:
        break
    }
  }

  const channelScores = {
    poa: Math.max(0, Math.round(100 - poaPenalty)),
    tAmb: Math.max(0, Math.round(100 - tAmbPenalty)),
    pAc: Math.max(0, Math.round(100 - pAcPenalty)),
    heatsink: Math.max(0, Math.round(100 - heatsinkPenalty)),
  }

  // Overall weighted health score: POA (35%), pAc (35%), tAmb (15%), heatsink (15%)
  const overallHealthScore = Math.round(
    channelScores.poa * 0.35 +
    channelScores.pAc * 0.35 +
    channelScores.tAmb * 0.15 +
    channelScores.heatsink * 0.15
  )

  const cleanedTelemetry = {
    ...telemetry,
    records,
    qc: {
      healthScore: overallHealthScore,
      driftDetected: driftResult.hasDrift,
      driftFactor: driftResult.driftFactor,
    },
  }

  return {
    overallHealthScore,
    channelScores,
    issues: allIssues,
    cleanedTelemetry,
    summary: {
      totalSamples: records.length,
      imputedSamples: imputedCount,
      unusableSamples: unusableCount,
      completenessPct: Math.round(((records.length - unusableCount) / Math.max(1, records.length)) * 1000) / 10,
      driftDetected: driftResult.hasDrift,
    },
  }
}
