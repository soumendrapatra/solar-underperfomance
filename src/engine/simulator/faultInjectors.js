/**
 * Fault Injection Engine for Solar PV Simulation.
 * Takes clean telemetry and returns modified telemetry with ground-truth fault labels.
 * Pure JavaScript, no external dependencies.
 */

/**
 * Deep clones telemetry data structures to preserve pure-function behavior.
 * @template T
 * @param {T} data
 * @returns {T}
 */
export function cloneTelemetry(data) {
  return JSON.parse(JSON.stringify(data))
}

/**
 * Parse a string asset path like 'INV-01/SCB-01/S04' into components.
 * @param {string|object} target
 * @returns {{ inverterId: string, scbId: string, stringId: string }}
 */
export function parseStringTarget(target) {
  if (typeof target === 'object' && target !== null) {
    return {
      inverterId: target.inverterId ?? 'INV-01',
      scbId: target.scbId ?? 'SCB-01',
      stringId: target.stringId ?? 'S01',
    }
  }
  const parts = String(target).split('/')
  return {
    inverterId: parts[0] || 'INV-01',
    scbId: parts[1] || 'SCB-01',
    stringId: parts[2] || 'S01',
  }
}

/**
 * Injects progressive soiling across the plant or a specific inverter block.
 * @param {object} telemetry - Simulation telemetry container
 * @param {object} [options]
 * @param {number} [options.ratePerDay=0.0025] - Soiling loss accumulation rate (0.15% - 0.4%/day)
 * @param {string[]} [options.targetInverters=null] - Specific inverters, or null for whole plant
 * @param {number} [options.startDay=0] - Day index to start accumulation
 * @param {number} [options.cleaningDay=null] - Day when washing/rain resets soiling
 * @returns {object} Modified telemetry with ground truth label
 */
export function injectSoiling(telemetry, options = {}) {
  const sim = cloneTelemetry(telemetry)
  const {
    ratePerDay = 0.0025, // 0.25 %/day
    targetInverters = null,
    startDay = 0,
    cleaningDay = null,
  } = options

  const stepsPerDay = 288
  let maxSoilingLoss = 0
  let faultStart = null
  let faultEnd = null

  for (let i = 0; i < sim.records.length; i++) {
    const rec = sim.records[i]
    const day = Math.floor(i / stepsPerDay)

    if (day < startDay) continue

    let effectiveDay = day - startDay
    if (cleaningDay !== null && day >= cleaningDay) {
      // Rain or cleaning resets soiling
      effectiveDay = Math.max(0, day - cleaningDay)
    }

    const lossFraction = Math.min(0.25, effectiveDay * ratePerDay)
    const factor = 1 - lossFraction
    if (lossFraction > maxSoilingLoss) maxSoilingLoss = lossFraction

    if (lossFraction > 0.005) {
      if (!faultStart) faultStart = rec.timestamp
      faultEnd = rec.timestamp
    }

    const invKeys = targetInverters || Object.keys(rec.inverters)
    for (const invId of invKeys) {
      const invData = rec.inverters[invId]
      if (!invData || invData.status === 'OFFLINE') continue

      // Apply soiling reduction to string currents and power
      for (const scbId in invData.scbs) {
        const scb = invData.scbs[scbId]
        if (scb.strings) {
          scb.strings = scb.strings.map((c) => Math.round(c * factor * 100) / 100)
          scb.iDc = Math.round(scb.strings.reduce((s, c) => s + c, 0) * 10) / 10
        } else {
          scb.iDc = Math.round(scb.iDc * factor * 10) / 10
        }
      }

      for (const mppt of invData.mppts) {
        mppt.iDc = Math.round(mppt.iDc * factor * 10) / 10
        mppt.pDc = Math.round(mppt.pDc * factor * 10) / 10
      }

      invData.pDc = Math.round(invData.pDc * factor * 10) / 10
      if (invData.status !== 'OFFLINE') {
        const newPac = invData.pDc * 0.984
        invData.pAc = Math.round(Math.min(1250, newPac) * 10) / 10
        if (invData.pAc < 1250 && invData.status === 'CLIPPING') {
          invData.status = 'NORMAL'
          invData.isClipping = false
        }
      }
    }
  }

  sim.labels.push({
    id: `label-soiling-${Date.now()}`,
    faultType: 'soiling',
    assetId: targetInverters ? targetInverters.join(',') : sim.plant.id,
    start: faultStart || sim.records[0]?.timestamp,
    end: faultEnd || sim.records[sim.records.length - 1]?.timestamp,
    severity: Math.round(maxSoilingLoss * 1000) / 1000,
    isFault: true,
    description: `Uniform soiling accumulation at ${(ratePerDay * 100).toFixed(2)} %/day`,
    details: { ratePerDay, targetInverters, cleaningDay },
  })

  return sim
}

/**
 * Injects daily morning partial shading on targeted strings (e.g. tracker row-to-row or structure shading).
 * @param {object} telemetry
 * @param {object} [options]
 * @param {string[]} [options.targetStrings] - String IDs (e.g. ['INV-01/SCB-01/S01', 'INV-01/SCB-01/S02'])
 * @param {number} [options.maxElevation=22] - Elevation limit below which shading occurs
 * @param {boolean} [options.morningOnly=true] - Only morning (azimuth < 180)
 * @param {number} [options.severity=0.70] - Current drop fraction on shaded string
 * @returns {object} Modified telemetry
 */
export function injectPartialShading(telemetry, options = {}) {
  const sim = cloneTelemetry(telemetry)
  const {
    targetStrings = ['INV-01/SCB-01/S01', 'INV-01/SCB-01/S02'],
    maxElevation = 22,
    morningOnly = true,
    severity = 0.70,
  } = options

  const targets = targetStrings.map(parseStringTarget)
  let faultStart = null
  let faultEnd = null

  for (let i = 0; i < sim.records.length; i++) {
    const rec = sim.records[i]
    const { solarElevation, solarAzimuth } = rec.weather

    const isShadedWindow =
      solarElevation > 1.0 &&
      solarElevation < maxElevation &&
      (!morningOnly || solarAzimuth < 180)

    if (!isShadedWindow) continue

    if (!faultStart) faultStart = rec.timestamp
    faultEnd = rec.timestamp

    for (const target of targets) {
      const invData = rec.inverters[target.inverterId]
      if (!invData || invData.status === 'OFFLINE') continue

      const scb = invData.scbs?.[target.scbId]
      if (!scb) continue

      const sIdx = parseInt(target.stringId.replace(/\D/g, ''), 10) - 1
      if (scb.strings && scb.strings[sIdx] !== undefined) {
        const oldCurrent = scb.strings[sIdx]
        const newCurrent = Math.round(oldCurrent * (1 - severity) * 100) / 100
        scb.strings[sIdx] = newCurrent

        const currentDiff = oldCurrent - newCurrent
        scb.iDc = Math.max(0, Math.round((scb.iDc - currentDiff) * 10) / 10)

        // Adjust MPPT & Inverter DC power
        const mppt = invData.mppts.find((m) =>
          m.id === (target.scbId === 'SCB-01' || target.scbId === 'SCB-02' ? 'MPPT-1' : 'MPPT-2')
        )
        if (mppt) {
          mppt.iDc = Math.max(0, Math.round((mppt.iDc - currentDiff * 2.116) * 10) / 10)
          mppt.pDc = Math.max(0, Math.round(((mppt.vDc * mppt.iDc) / 1000) * 10) / 10)
        }

        invData.pDc = Math.round(invData.mppts.reduce((s, m) => s + m.pDc, 0) * 10) / 10
        if (invData.status !== 'OFFLINE') {
          invData.pAc = Math.round(Math.min(1250, invData.pDc * 0.984) * 10) / 10
        }
      }
    }
  }

  sim.labels.push({
    id: `label-shading-${Date.now()}`,
    faultType: 'partial_shading',
    assetId: targetStrings.join(', '),
    start: faultStart || sim.records[0]?.timestamp,
    end: faultEnd || sim.records[sim.records.length - 1]?.timestamp,
    severity,
    isFault: true,
    description: `Repeatable morning partial shading below ${maxElevation} deg elevation`,
    details: { targetStrings, maxElevation, severity },
  })

  return sim
}

/**
 * Injects inverter fan failure causing heatsink temperature to rise from 18 C delta to 38 C delta,
 * resulting in thermal derating when heatsink > 72 C.
 * @param {object} telemetry
 * @param {object} [options]
 * @param {string} [options.inverterId='INV-02']
 * @param {number} [options.startDay=2]
 * @param {number} [options.capFraction=0.76] - Derating cap fraction (70% - 85%)
 * @returns {object} Modified telemetry
 */
export function injectInverterDerating(telemetry, options = {}) {
  const sim = cloneTelemetry(telemetry)
  const {
    inverterId = 'INV-02',
    startDay = 2,
    capFraction = 0.76, // 76% AC capacity cap
  } = options

  const stepsPerDay = 288
  let faultStart = null
  let faultEnd = null

  for (let i = 0; i < sim.records.length; i++) {
    const rec = sim.records[i]
    const day = Math.floor(i / stepsPerDay)
    if (day < startDay) continue

    const invData = rec.inverters[inverterId]
    if (!invData || invData.status === 'OFFLINE') continue

    const tAmb = rec.weather.tAmb
    // Degrading cooling fan: heatsink-ambient delta rises up to 38 C
    const degradedDelta = 38
    const loadHeat = (invData.pAc / 1250) * 16
    const elevatedHeatsink = Math.round((tAmb + degradedDelta + loadHeat) * 10) / 10
    invData.heatsinkTemp = elevatedHeatsink

    // Thermal derating protection triggers when heatsink > 72 C
    if (elevatedHeatsink > 72) {
      if (!faultStart) faultStart = rec.timestamp
      faultEnd = rec.timestamp

      const maxAllowedPac = 1250 * capFraction // e.g. 950 kW
      if (invData.pAc > maxAllowedPac) {
        invData.pAc = Math.round(maxAllowedPac * 10) / 10
        invData.status = 'DERATED'
      }
    }
  }

  sim.labels.push({
    id: `label-derating-${Date.now()}`,
    faultType: 'inverter_thermal_derating',
    assetId: inverterId,
    start: faultStart || sim.records[0]?.timestamp,
    end: faultEnd || sim.records[sim.records.length - 1]?.timestamp,
    severity: Math.round((1 - capFraction) * 100) / 100,
    isFault: true,
    description: `Inverter cooling fan failure causing thermal derating to ${(capFraction * 100).toFixed(0)} % when heatsink > 72 C`,
    details: { inverterId, startDay, capFraction },
  })

  return sim
}

/**
 * Scans for natural inverter power clipping and labels it as normal operation.
 * @param {object} telemetry
 * @returns {object} Telemetry with normal clipping label
 */
export function injectClipping(telemetry) {
  const sim = cloneTelemetry(telemetry)
  let clipCount = 0
  let firstClip = null
  let lastClip = null

  for (let i = 0; i < sim.records.length; i++) {
    const rec = sim.records[i]
    for (const invId in rec.inverters) {
      const invData = rec.inverters[invId]
      if (invData.isClipping || invData.status === 'CLIPPING') {
        clipCount++
        if (!firstClip) firstClip = rec.timestamp
        lastClip = rec.timestamp
      }
    }
  }

  if (clipCount > 0) {
    sim.labels.push({
      id: `label-clipping-${Date.now()}`,
      faultType: 'inverter_clipping',
      assetId: sim.plant.id,
      start: firstClip,
      end: lastClip,
      severity: 0,
      isFault: false,
      status: 'normal',
      description: 'Inverter power clipping at rated AC capacity (normal high-irradiance operation)',
      details: { clipCount },
    })
  }

  return sim
}

/**
 * Injects a string open circuit fault (e.g. blown string fuse, disconnected MC4 connector).
 * Current drops to ~0 (< 0.3 A), voltage floats near Voc.
 * @param {object} telemetry
 * @param {object} [options]
 * @param {string|object} [options.targetString='INV-01/SCB-01/S04']
 * @param {number} [options.startStepIndex=100]
 * @param {number} [options.endStepIndex=null]
 * @returns {object} Modified telemetry
 */
export function injectStringOpenCircuit(telemetry, options = {}) {
  const sim = cloneTelemetry(telemetry)
  const {
    targetString = 'INV-01/SCB-01/S04',
    startStepIndex = 100,
    endStepIndex = null,
  } = options

  const target = parseStringTarget(targetString)
  const fullId = `${target.inverterId}/${target.scbId}/${target.stringId}`
  const endIdx = endStepIndex !== null ? endStepIndex : sim.records.length - 1

  for (let i = startStepIndex; i <= endIdx; i++) {
    const rec = sim.records[i]
    const invData = rec.inverters[target.inverterId]
    if (!invData || invData.status === 'OFFLINE') continue

    const scb = invData.scbs?.[target.scbId]
    if (!scb) continue

    const sIdx = parseInt(target.stringId.replace(/\D/g, ''), 10) - 1
    if (scb.strings && scb.strings[sIdx] !== undefined) {
      const lostCurrent = scb.strings[sIdx]
      // Open circuit: current drops to < 0.3 A (leakage / sensor noise ~ 0.05 A)
      scb.strings[sIdx] = 0.05

      // Voltage floats near Voc
      scb.floatingVoc = invData.baseVoc

      const currentDiff = lostCurrent - 0.05
      scb.iDc = Math.max(0, Math.round((scb.iDc - currentDiff) * 10) / 10)

      // Adjust MPPT & Inverter DC power
      const mppt = invData.mppts.find((m) =>
        m.id === (target.scbId === 'SCB-01' || target.scbId === 'SCB-02' ? 'MPPT-1' : 'MPPT-2')
      )
      if (mppt) {
        mppt.iDc = Math.max(0, Math.round((mppt.iDc - currentDiff * 2.116) * 10) / 10)
        mppt.pDc = Math.max(0, Math.round(((mppt.vDc * mppt.iDc) / 1000) * 10) / 10)
      }

      invData.pDc = Math.round(invData.mppts.reduce((s, m) => s + m.pDc, 0) * 10) / 10
      if (invData.status !== 'OFFLINE') {
        invData.pAc = Math.round(Math.min(1250, invData.pDc * 0.984) * 10) / 10
      }
    }
  }

  sim.labels.push({
    id: `label-open-circuit-${Date.now()}`,
    faultType: 'string_open_circuit',
    assetId: fullId,
    start: sim.records[startStepIndex]?.timestamp,
    end: sim.records[endIdx]?.timestamp,
    severity: 1.0,
    isFault: true,
    description: 'String open circuit: current < 0.3 A and voltage floating at Voc',
    details: { targetString: fullId, startStepIndex, endStepIndex: endIdx },
  })

  return sim
}

/**
 * Injects a bypass diode failure (short circuit) in a module on a string.
 * String voltage drops by roughly one third of a module (~13.9 V per diode), while current remains normal.
 * @param {object} telemetry
 * @param {object} [options]
 * @param {string|object} [options.targetString='INV-01/SCB-02/S08']
 * @param {number} [options.failedDiodes=1] - Number of shorted bypass diodes
 * @param {number} [options.startStepIndex=80]
 * @returns {object} Modified telemetry
 */
export function injectBypassDiodeFailure(telemetry, options = {}) {
  const sim = cloneTelemetry(telemetry)
  const {
    targetString = 'INV-01/SCB-02/S08',
    failedDiodes = 1,
    startStepIndex = 80,
  } = options

  const target = parseStringTarget(targetString)
  const fullId = `${target.inverterId}/${target.scbId}/${target.stringId}`
  // Standard 545 Wp module Vmp ~ 41.8 V; 3 diodes per module -> ~13.93 V drop per diode
  const voltageDrop = Math.round(failedDiodes * (41.8 / 3) * 10) / 10

  for (let i = startStepIndex; i < sim.records.length; i++) {
    const rec = sim.records[i]
    const invData = rec.inverters[target.inverterId]
    if (!invData || invData.status === 'OFFLINE') continue

    const scb = invData.scbs?.[target.scbId]
    if (!scb) continue

    // Voltage drops on this string, but current remains normal
    scb.failedBypassDiodes = failedDiodes
    scb.stringVoltageDrop = voltageDrop

    // Slightly reduces string operating power by mismatch (~1.2% per failed diode)
    const powerLossFactor = 1 - 0.012 * failedDiodes
    const mppt = invData.mppts.find((m) =>
      m.id === (target.scbId === 'SCB-01' || target.scbId === 'SCB-02' ? 'MPPT-1' : 'MPPT-2')
    )
    if (mppt) {
      mppt.pDc = Math.round(mppt.pDc * powerLossFactor * 10) / 10
    }
  }

  sim.labels.push({
    id: `label-diode-failure-${Date.now()}`,
    faultType: 'bypass_diode_failure',
    assetId: fullId,
    start: sim.records[startStepIndex]?.timestamp,
    end: sim.records[sim.records.length - 1]?.timestamp,
    severity: Math.round((voltageDrop / 1170.4) * 1000) / 1000,
    isFault: true,
    description: `Bypass diode failure: string voltage dropped by ${voltageDrop} V (${failedDiodes} diode)`,
    details: { targetString: fullId, failedDiodes, voltageDrop },
  })

  return sim
}

/**
 * Injects grid curtailment capping all inverters to an active export limit setpoint.
 * @param {object} telemetry
 * @param {object} [options]
 * @param {number} [options.setpointPct=60] - Active power cap percentage (e.g. 60%)
 * @param {number} [options.startHour=12] - Start hour of curtailment window
 * @param {number} [options.endHour=15] - End hour of curtailment window
 * @param {number[]} [options.days=null] - Specific days (0-indexed), or null for all days
 * @returns {object} Modified telemetry
 */
export function injectCurtailment(telemetry, options = {}) {
  const sim = cloneTelemetry(telemetry)
  const {
    setpointPct = 60,
    startHour = 12.0,
    endHour = 15.0,
    days = null,
  } = options

  const stepsPerDay = 288
  let faultStart = null
  let faultEnd = null

  for (let i = 0; i < sim.records.length; i++) {
    const rec = sim.records[i]
    const day = Math.floor(i / stepsPerDay)
    if (days && !days.includes(day)) continue

    const stepInDay = i % stepsPerDay
    const hour = (stepInDay * 5) / 60

    if (hour >= startHour && hour <= endHour) {
      if (!faultStart) faultStart = rec.timestamp
      faultEnd = rec.timestamp

      for (const invId in rec.inverters) {
        const invData = rec.inverters[invId]
        if (invData.status === 'OFFLINE') continue

        invData.gridSetpointPct = setpointPct
        const capLimit = 1250 * (setpointPct / 100)
        if (invData.pAc > capLimit) {
          invData.pAc = Math.round(capLimit * 10) / 10
          invData.status = 'CURTAILED'
        }
      }
    }
  }

  sim.labels.push({
    id: `label-curtailment-${Date.now()}`,
    faultType: 'grid_curtailment',
    assetId: sim.plant.id,
    start: faultStart || sim.records[0]?.timestamp,
    end: faultEnd || sim.records[sim.records.length - 1]?.timestamp,
    severity: Math.round(((100 - setpointPct) / 100) * 100) / 100,
    isFault: true,
    description: `Grid curtailment enforced at ${setpointPct} % export setpoint`,
    details: { setpointPct, startHour, endHour, days },
  })

  return sim
}

/**
 * Injects pyranometer sensor drift: the WMS POA sensor reads 6-12% low, drifting gradually,
 * while inverters and physical generation remain normal.
 * @param {object} telemetry
 * @param {object} [options]
 * @param {number} [options.driftRatePerDay=0.015] - Drift rate per day
 * @param {number} [options.maxDrift=0.10] - Maximum drift fraction (e.g. 0.10 = 10% low)
 * @param {number} [options.startDay=1]
 * @returns {object} Modified telemetry
 */
export function injectPyranometerDrift(telemetry, options = {}) {
  const sim = cloneTelemetry(telemetry)
  const {
    driftRatePerDay = 0.015,
    maxDrift = 0.10, // 10% low
    startDay = 1,
  } = options

  const stepsPerDay = 288
  let faultStart = null
  let faultEnd = null

  for (let i = 0; i < sim.records.length; i++) {
    const rec = sim.records[i]
    const day = Math.floor(i / stepsPerDay)

    if (day >= startDay) {
      if (!faultStart) faultStart = rec.timestamp
      faultEnd = rec.timestamp

      const drift = Math.min(maxDrift, (day - startDay + 1) * driftRatePerDay)
      // Drift the WMS POA reading downward
      rec.weather.poaSensor = Math.max(0, Math.round(rec.weather.poa * (1 - drift) * 10) / 10)
      rec.weather.ghiSensor = Math.max(0, Math.round(rec.weather.ghi * (1 - drift * 0.8) * 10) / 10)
      rec.weather.sensorDriftPct = Math.round(-drift * 1000) / 10
    } else {
      rec.weather.poaSensor = rec.weather.poa
      rec.weather.ghiSensor = rec.weather.ghi
      rec.weather.sensorDriftPct = 0
    }
  }

  sim.labels.push({
    id: `label-pyranometer-drift-${Date.now()}`,
    faultType: 'pyranometer_drift',
    assetId: 'WMS-01',
    start: faultStart || sim.records[0]?.timestamp,
    end: faultEnd || sim.records[sim.records.length - 1]?.timestamp,
    severity: maxDrift,
    isFault: true,
    description: `Pyranometer calibration drift: WMS POA reading ${(maxDrift * 100).toFixed(1)} % low`,
    details: { driftRatePerDay, maxDrift, startDay },
  })

  return sim
}
