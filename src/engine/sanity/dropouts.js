/**
 * Telemetry Dropout & Missing Data Engine.
 * Detects missing timestamps, null/NaN runs, computes daily completeness %,
 * forward-fills short gaps (<= 15 min) with imputation flags, and marks longer gaps unusable.
 * Pure JavaScript, no external dependencies.
 */

/**
 * Checks if a value is valid numeric data.
 * @param {any} val
 * @returns {boolean}
 */
export function isValidNum(val) {
  return typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val)
}

/**
 * Repairs missing timestamps in a time series by inserting placeholder records.
 * @param {Array<object>} records
 * @param {number} [stepMinutes=5]
 * @returns {Array<object>} Uniformly spaced records
 */
export function fillMissingTimestamps(records, stepMinutes = 5) {
  if (!records || records.length === 0) return []

  const stepMs = stepMinutes * 60 * 1000
  const filled = []

  for (let i = 0; i < records.length; i++) {
    const curr = records[i]
    if (i === 0) {
      filled.push(curr)
      continue
    }

    const prev = filled[filled.length - 1]
    const prevMs = new Date(prev.timestamp).getTime()
    const currMs = new Date(curr.timestamp).getTime()
    const gapMs = currMs - prevMs

    // If gap is more than 1.5 * step, synthesize missing rows
    if (gapMs > 1.5 * stepMs) {
      const missingCount = Math.round(gapMs / stepMs) - 1
      for (let m = 1; m <= missingCount; m++) {
        const synthMs = prevMs + m * stepMs
        const synthDate = new Date(synthMs)
        const istDate = new Date(synthMs + 5.5 * 3600 * 1000)
        filled.push({
          timestamp: istDate.toISOString().replace('Z', '+05:30'),
          stepIndex: prev.stepIndex !== undefined ? prev.stepIndex + m : undefined,
          isSyntheticTimestamp: true,
          weather: null,
          inverters: null,
        })
      }
    }

    filled.push(curr)
  }

  return filled
}

/**
 * Cleans a single channel: forward-fills short gaps (<= 15 min, marking isImputed),
 * and marks gaps > 15 min as isUnusable.
 *
 * @param {Array<object>} records
 * @param {string|Function} getter - Extractor for the target value
 * @param {Function} setter - Setter function to update the cleaned value & metadata
 * @param {object} [options]
 * @param {string} [options.channel='poa']
 * @param {string} [options.assetId='WMS-01']
 * @param {number} [options.stepMinutes=5]
 * @param {number} [options.maxImputeMinutes=15] - Maximum gap duration eligible for forward-fill (15 min)
 * @returns {{
 *   cleanedRecords: Array<object>,
 *   issues: Array<object>,
 *   dailyCompleteness: Record<string, { total: number, valid: number, imputed: number, unusable: number, pct: number }>
 * }}
 */
export function cleanChannelDropouts(records, getter, setter, options = {}) {
  const {
    channel = 'poa',
    assetId = 'WMS-01',
    stepMinutes = 5,
    maxImputeMinutes = 15,
  } = options

  const maxImputeSteps = Math.floor(maxImputeMinutes / stepMinutes) // 3 steps at 5 min
  const issues = []
  const dailyCompleteness = {}

  let gapStartIdx = -1
  let lastValidValue = null
  let lastValidIdx = -1

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    const val = getter(rec)
    const dayKey = (rec.timestamp || '').slice(0, 10) || 'unknown'

    if (!dailyCompleteness[dayKey]) {
      dailyCompleteness[dayKey] = { total: 0, valid: 0, imputed: 0, unusable: 0, pct: 100 }
    }
    dailyCompleteness[dayKey].total++

    if (isValidNum(val)) {
      // If we just exited a gap, resolve it
      if (gapStartIdx !== -1) {
        const gapLength = i - gapStartIdx
        const gapDurationMin = gapLength * stepMinutes
        const isEligibleForImpute = gapLength <= maxImputeSteps && lastValidValue !== null

        if (isEligibleForImpute) {
          // Forward-fill each missing sample and flag isImputed: true
          for (let k = gapStartIdx; k < i; k++) {
            setter(records[k], lastValidValue, { isImputed: true, isUnusable: false })
            const kDay = (records[k].timestamp || '').slice(0, 10) || 'unknown'
            if (dailyCompleteness[kDay]) dailyCompleteness[kDay].imputed++
          }

          issues.push({
            channel,
            assetId,
            type: 'dropout',
            severity: 0.2,
            action: 'imputed_forward_fill',
            startIndex: gapStartIdx,
            endIndex: i - 1,
            startTime: records[gapStartIdx]?.timestamp,
            endTime: records[i - 1]?.timestamp,
            durationMinutes: gapDurationMin,
            description: `${assetId} ${channel} missing for ${gapDurationMin} min (< 15 min). Imputed via forward-fill.`,
          })
        } else {
          // Gap is > 15 min: mark as unusable
          for (let k = gapStartIdx; k < i; k++) {
            setter(records[k], null, { isImputed: false, isUnusable: true })
            const kDay = (records[k].timestamp || '').slice(0, 10) || 'unknown'
            if (dailyCompleteness[kDay]) dailyCompleteness[kDay].unusable++
          }

          issues.push({
            channel,
            assetId,
            type: 'dropout',
            severity: Math.min(1.0, gapDurationMin / 120),
            action: 'marked_unusable',
            startIndex: gapStartIdx,
            endIndex: i - 1,
            startTime: records[gapStartIdx]?.timestamp,
            endTime: records[i - 1]?.timestamp,
            durationMinutes: gapDurationMin,
            description: `${assetId} ${channel} dropout lasting ${gapDurationMin} min (> 15 min). Samples marked unusable.`,
          })
        }

        gapStartIdx = -1
      }

      lastValidValue = val
      lastValidIdx = i
      setter(rec, val, { isImputed: false, isUnusable: false })
      dailyCompleteness[dayKey].valid++
    } else {
      // Value is null, undefined, or NaN
      if (gapStartIdx === -1) {
        gapStartIdx = i
      }
    }
  }

  // Handle trailing gap extending to end of dataset
  if (gapStartIdx !== -1) {
    const gapLength = records.length - gapStartIdx
    const gapDurationMin = gapLength * stepMinutes
    const isEligibleForImpute = gapLength <= maxImputeSteps && lastValidValue !== null

    for (let k = gapStartIdx; k < records.length; k++) {
      if (isEligibleForImpute) {
        setter(records[k], lastValidValue, { isImputed: true, isUnusable: false })
        const kDay = (records[k].timestamp || '').slice(0, 10) || 'unknown'
        if (dailyCompleteness[kDay]) dailyCompleteness[kDay].imputed++
      } else {
        setter(records[k], null, { isImputed: false, isUnusable: true })
        const kDay = (records[k].timestamp || '').slice(0, 10) || 'unknown'
        if (dailyCompleteness[kDay]) dailyCompleteness[kDay].unusable++
      }
    }

    issues.push({
      channel,
      assetId,
      type: 'dropout',
      severity: isEligibleForImpute ? 0.2 : 0.8,
      action: isEligibleForImpute ? 'imputed_forward_fill' : 'marked_unusable',
      startIndex: gapStartIdx,
      endIndex: records.length - 1,
      startTime: records[gapStartIdx]?.timestamp,
      endTime: records[records.length - 1]?.timestamp,
      durationMinutes: gapDurationMin,
      description: `${assetId} ${channel} trailing dropout of ${gapDurationMin} min.`,
    })
  }

  // Compute final percentages
  for (const day in dailyCompleteness) {
    const d = dailyCompleteness[day]
    d.pct = Math.round(((d.valid + d.imputed) / Math.max(1, d.total)) * 1000) / 10
  }

  return {
    cleanedRecords: records,
    issues,
    dailyCompleteness,
  }
}
