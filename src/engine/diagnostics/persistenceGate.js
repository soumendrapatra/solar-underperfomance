/**
 * Persistence Gate & Fault Verification Engine.
 * Filters out transient spikes and false alarms by requiring candidate faults to satisfy
 * strict temporal persistence criteria across STABLE daytime samples only:
 * - Slow faults (soiling, drift): >= 2 full days of persistent stable evidence
 * - Fast faults (open circuit, diode, derate): >= 45 consecutive stable minutes (9 samples at 5m)
 * Pure JavaScript, no external dependencies.
 */

// Classification of fault speeds and minimum persistence requirements
export const FAULT_PERSISTENCE_RULES = {
  // Slow faults require multi-day persistence
  soiling: {
    category: 'slow',
    minDays: 2,
    minStableSamplesPerDay: 12,
  },
  pyranometer_drift: {
    category: 'slow',
    minDays: 2,
    minStableSamplesPerDay: 12,
  },

  // Fast faults require intra-day continuous stable evidence
  string_open_circuit: {
    category: 'fast',
    minConsecutiveStableMinutes: 45, // 9 steps at 5-min intervals
    minStableSamples: 9,
  },
  bypass_diode_failure: {
    category: 'fast',
    minConsecutiveStableMinutes: 45,
    minStableSamples: 9,
  },
  inverter_thermal_derating: {
    category: 'fast',
    minConsecutiveStableMinutes: 40,
    minStableSamples: 8,
  },
  grid_curtailment: {
    category: 'fast',
    minConsecutiveStableMinutes: 30,
    minStableSamples: 6,
  },
  string_mismatch: {
    category: 'fast',
    minConsecutiveStableMinutes: 45,
    minStableSamples: 9,
  },
}

/**
 * Evaluates whether an array of raw candidate fault detections passes persistence gating.
 *
 * @param {Array<object>} candidates - Candidate fault instances
 * @param {Array<object>} filteredRecords - Telemetry records with isStable flags from transientFilter
 * @param {object} [options]
 * @returns {Array<object>} Only the candidates that passed persistence gating
 */
export function evaluatePersistence(candidates, filteredRecords, options = {}) {
  const raisedFaults = []

  for (const candidate of candidates) {
    const { faultType, assetId, instances = [] } = candidate
    const rule = FAULT_PERSISTENCE_RULES[faultType] || {
      category: 'fast',
      minStableSamples: 9,
      minConsecutiveStableMinutes: 45,
    }

    // Filter candidate instances down to those occurring on STABLE, usable samples
    const stableInstances = instances.filter((inst) => {
      const idx = inst.stepIndex
      const rec = filteredRecords[idx]
      return rec && rec.weather?.isStable === true && rec.weather?.isUnusable !== true
    })

    if (stableInstances.length === 0) {
      continue
    }

    if (rule.category === 'slow') {
      // Check multi-day persistence
      const dayCounts = {}
      for (const inst of stableInstances) {
        const day = (inst.timestamp || '').slice(0, 10)
        dayCounts[day] = (dayCounts[day] || 0) + 1
      }

      const qualifiedDays = Object.keys(dayCounts).filter(
        (day) => dayCounts[day] >= (rule.minStableSamplesPerDay || 10)
      )

      if (qualifiedDays.length >= (rule.minDays || 2)) {
        raisedFaults.push({
          ...candidate,
          isRaised: true,
          status: 'confirmed',
          category: 'slow',
          activeDaysCount: qualifiedDays.length,
          qualifiedDays,
          firstObserved: stableInstances[0]?.timestamp,
          lastObserved: stableInstances[stableInstances.length - 1]?.timestamp,
          persistenceProof: `${qualifiedDays.length} days of stable multi-day persistence (min ${rule.minDays} days required)`,
        })
      }
    } else {
      // Check consecutive stable duration for fast faults (>= 45 min = 9 samples at 5m)
      let maxConsecutive = 0
      let currentConsecutive = 0
      let runStart = null
      let bestRunStart = null
      let bestRunEnd = null

      // Sort by stepIndex
      stableInstances.sort((a, b) => a.stepIndex - b.stepIndex)

      for (let j = 0; j < stableInstances.length; j++) {
        if (j === 0) {
          currentConsecutive = 1
          runStart = stableInstances[0].timestamp
        } else {
          const stepDiff = stableInstances[j].stepIndex - stableInstances[j - 1].stepIndex
          // Samples must be consecutive steps (e.g. diff === 1)
          if (stepDiff === 1) {
            currentConsecutive++
          } else {
            if (currentConsecutive > maxConsecutive) {
              maxConsecutive = currentConsecutive
              bestRunStart = runStart
              bestRunEnd = stableInstances[j - 1].timestamp
            }
            currentConsecutive = 1
            runStart = stableInstances[j].timestamp
          }
        }
      }

      if (currentConsecutive > maxConsecutive) {
        maxConsecutive = currentConsecutive
        bestRunStart = runStart
        bestRunEnd = stableInstances[stableInstances.length - 1].timestamp
      }

      const durationMinutes = maxConsecutive * (options.stepMinutes || 5)
      const minRequiredMinutes = rule.minConsecutiveStableMinutes || 45

      if (durationMinutes >= minRequiredMinutes) {
        raisedFaults.push({
          ...candidate,
          isRaised: true,
          status: 'confirmed',
          category: 'fast',
          consecutiveStableMinutes: durationMinutes,
          consecutiveSamples: maxConsecutive,
          firstObserved: bestRunStart,
          lastObserved: bestRunEnd,
          persistenceProof: `Persisted continuously for ${durationMinutes} stable minutes (min ${minRequiredMinutes} min required)`,
        })
      }
    }
  }

  return raisedFaults
}
