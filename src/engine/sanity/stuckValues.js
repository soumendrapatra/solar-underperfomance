/**
 * Stuck Sensor Value Detection.
 * Detects sensor readings that remain frozen/unchanged (within epsilon)
 * for N consecutive samples during active daylight conditions.
 * Pure JavaScript, no external dependencies.
 */

/**
 * Detects stuck values in a single time-series channel.
 *
 * @param {Array<object>} records - Array of telemetry or weather records
 * @param {object} [options]
 * @param {string|Function} [options.accessor='poa'] - Property name or extractor function
 * @param {string} [options.channel='poa'] - Display name of the sensor channel
 * @param {string} [options.assetId='WMS-01'] - Asset identifier
 * @param {number} [options.consecutiveSamples=6] - Minimum consecutive unchanged samples (6 = 30 min at 5m)
 * @param {number} [options.epsilon=0.01] - Tolerance threshold to consider values identical
 * @param {boolean} [options.daylightOnly=true] - Only evaluate when sun is actively up
 * @param {number} [options.minThreshold=30.0] - Minimum value to avoid flagging nighttime zero as stuck
 * @returns {Array<{
 *   channel: string,
 *   assetId: string,
 *   type: 'stuck',
 *   startIndex: number,
 *   endIndex: number,
 *   startTime: string,
 *   endTime: string,
 *   durationMinutes: number,
 *   sampleCount: number,
 *   stuckValue: number,
 *   severity: number,
 *   description: string
 * }>}
 */
export function detectStuckValues(records, options = {}) {
  const {
    accessor = 'poa',
    channel = 'poa',
    assetId = 'WMS-01',
    consecutiveSamples = 6,
    epsilon = 0.01,
    daylightOnly = true,
    minThreshold = 30.0,
    stepMinutes = 5,
  } = options

  const getValue = typeof accessor === 'function'
    ? accessor
    : (r) => (r.weather ? r.weather[accessor] : r[accessor])

  const getElevation = (r) =>
    r.weather?.solarElevation ?? r.solarElevation ?? (getValue(r) > 0 ? 10 : 0)

  const flaggedWindows = []

  let runStartIndex = -1
  let runStartVal = null
  let runLength = 0

  for (let i = 0; i < records.length; i++) {
    const rec = records[i]
    const val = getValue(rec)
    const elev = getElevation(rec)

    const isDaylightActive = !daylightOnly || (elev > 2.0 && val !== null && val !== undefined && val >= minThreshold)

    if (val !== null && val !== undefined && !Number.isNaN(val) && isDaylightActive) {
      if (runStartVal === null) {
        // Start tracking a run
        runStartIndex = i
        runStartVal = val
        runLength = 1
      } else if (Math.abs(val - runStartVal) <= epsilon) {
        // Run continues
        runLength++
      } else {
        // Value changed: check if previous run was stuck
        if (runLength >= consecutiveSamples) {
          const startTime = records[runStartIndex]?.timestamp
          const endTime = records[i - 1]?.timestamp
          flaggedWindows.push({
            channel,
            assetId,
            type: 'stuck',
            startIndex: runStartIndex,
            endIndex: i - 1,
            startTime,
            endTime,
            durationMinutes: runLength * stepMinutes,
            sampleCount: runLength,
            stuckValue: runStartVal,
            severity: Math.min(1.0, runLength / (consecutiveSamples * 3)),
            description: `${assetId} ${channel.toUpperCase()} frozen at ${runStartVal} for ${runLength * stepMinutes} min`,
          })
        }
        runStartIndex = i
        runStartVal = val
        runLength = 1
      }
    } else {
      // Inactive (night or invalid) ends any active daytime run
      if (runLength >= consecutiveSamples) {
        const startTime = records[runStartIndex]?.timestamp
        const endTime = records[i - 1]?.timestamp
        flaggedWindows.push({
          channel,
          assetId,
          type: 'stuck',
          startIndex: runStartIndex,
          endIndex: i - 1,
          startTime,
          endTime,
          durationMinutes: runLength * stepMinutes,
          sampleCount: runLength,
          stuckValue: runStartVal,
          severity: Math.min(1.0, runLength / (consecutiveSamples * 3)),
          description: `${assetId} ${channel.toUpperCase()} frozen at ${runStartVal} for ${runLength * stepMinutes} min`,
        })
      }
      runStartIndex = -1
      runStartVal = null
      runLength = 0
    }
  }

  // Handle run extending to the very end of records
  if (runLength >= consecutiveSamples) {
    const startTime = records[runStartIndex]?.timestamp
    const endTime = records[records.length - 1]?.timestamp
    flaggedWindows.push({
      channel,
      assetId,
      type: 'stuck',
      startIndex: runStartIndex,
      endIndex: records.length - 1,
      startTime,
      endTime,
      durationMinutes: runLength * stepMinutes,
      sampleCount: runLength,
      stuckValue: runStartVal,
      severity: Math.min(1.0, runLength / (consecutiveSamples * 3)),
      description: `${assetId} ${channel.toUpperCase()} frozen at ${runStartVal} for ${runLength * stepMinutes} min`,
    })
  }

  return flaggedWindows
}

/**
 * Scans all primary telemetry channels across a simulation or SCADA dataset for stuck values.
 *
 * @param {object} telemetry - Telemetry container with records
 * @returns {Array<object>} All detected stuck window issues
 */
export function scanTelemetryForStuckValues(telemetry) {
  const records = telemetry.records || []
  if (records.length === 0) return []

  const issues = []

  // 1. Pyranometer POA
  const poaStuck = detectStuckValues(records, {
    accessor: (r) => r.weather?.poa ?? r.poa,
    channel: 'poa',
    assetId: 'WMS-01',
    consecutiveSamples: 6, // 30 min
    epsilon: 0.01,
    minThreshold: 40.0,
  })
  issues.push(...poaStuck)

  // 2. Ambient Temperature
  const tAmbStuck = detectStuckValues(records, {
    accessor: (r) => r.weather?.tAmb ?? r.tAmb,
    channel: 'tAmb',
    assetId: 'WMS-01',
    consecutiveSamples: 12, // 60 min during daylight
    epsilon: 0.005,
    minThreshold: -10,
  })
  issues.push(...tAmbStuck)

  // 3. Inverter Heatsink Temperature (per inverter)
  const firstRec = records[0]
  if (firstRec?.inverters) {
    for (const invId in firstRec.inverters) {
      const invStuck = detectStuckValues(records, {
        accessor: (r) => r.inverters?.[invId]?.heatsinkTemp,
        channel: 'heatsinkTemp',
        assetId: invId,
        consecutiveSamples: 8, // 40 min
        epsilon: 0.005,
        minThreshold: 20,
      })
      issues.push(...invStuck)
    }
  }

  return issues
}
