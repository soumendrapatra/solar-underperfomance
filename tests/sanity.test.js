import { describe, it, expect } from 'vitest'
import {
  detectStuckValues,
  scanTelemetryForStuckValues,
} from '../src/engine/sanity/stuckValues.js'
import {
  cleanChannelDropouts,
  fillMissingTimestamps,
} from '../src/engine/sanity/dropouts.js'
import {
  validatePhysicalRanges,
} from '../src/engine/sanity/physicalRanges.js'
import {
  analyzePyranometerDrift,
} from '../src/engine/sanity/pyranometerDrift.js'
import {
  generateSanityReport,
} from '../src/engine/sanity/sanityReport.js'
import {
  createPlant,
} from '../src/engine/simulator/plantFactory.js'
import {
  generateWeather,
} from '../src/engine/simulator/weather.js'
import {
  generateCleanTelemetry,
} from '../src/engine/simulator/telemetryGenerator.js'

describe('Sanity Engine: Stuck Sensor Value Detection', () => {
  it('detects a stuck POA sensor value frozen during daylight', () => {
    const plant = createPlant()
    const weather = generateWeather(plant, '2024-03-15', 1, 5, 42)

    // Inject stuck POA value across 8 consecutive midday intervals (40 min)
    const stuckPoaValue = 784.5
    for (let i = 140; i <= 147; i++) {
      weather[i].poa = stuckPoaValue
    }

    const stuckIssues = detectStuckValues(weather, {
      accessor: (r) => r.poa,
      channel: 'poa',
      consecutiveSamples: 6, // 30 min minimum
      epsilon: 0.01,
      minThreshold: 50,
    })

    expect(stuckIssues.length).toBeGreaterThanOrEqual(1)
    const issue = stuckIssues.find((s) => s.stuckValue === stuckPoaValue)
    expect(issue).toBeDefined()
    expect(issue.sampleCount).toBe(8)
    expect(issue.durationMinutes).toBe(40)
    expect(issue.type).toBe('stuck')
    expect(issue.channel).toBe('poa')
  })
})

describe('Sanity Engine: Pyranometer Drift Detection', () => {
  it('detects 8 % pyranometer drift and estimates factor within 1.5 % tolerance', () => {
    const plant = createPlant()
    const days = 5
    const weather = generateWeather(plant, '2024-03-15', days, 5, 101)
    const telemetry = generateCleanTelemetry(plant, weather, { includeStrings: true })

    // Inject precisely 8% low sensor drift across all days
    const injectedDrift = 0.08
    for (const rec of telemetry.records) {
      rec.weather.poaSensor = Math.round(rec.weather.poa * (1 - injectedDrift) * 10) / 10
    }

    const result = analyzePyranometerDrift(telemetry, {
      minDaysDrift: 3,
      minPoaThreshold: 150,
      driftThresholdPct: 0.04,
    })

    expect(result.hasDrift).toBe(true)
    expect(result.direction).toBe('low')
    expect(result.confidence).toBeGreaterThan(0.7)

    // Crucial assertion: estimated factor must be within 1.5% of injected 8% (i.e. [0.065, 0.095])
    const estimationError = Math.abs(result.driftFactor - injectedDrift)
    expect(estimationError).toBeLessThan(0.015)

    // Verify corrected series restores irradiance
    const sampleRec = result.correctedRecords[150]
    if (sampleRec.weather.poa > 200) {
      expect(sampleRec.weather.poaCorrected).toBeGreaterThan(sampleRec.weather.poaRaw)
      expect(sampleRec.weather.isDriftCorrected).toBe(true)
    }
  })
})

describe('Sanity Engine: Dropouts & Imputation', () => {
  it('forward-fills short gaps (<= 15 min) and marks them imputed', () => {
    const sampleRecords = [
      { timestamp: '2024-03-15T12:00:00+05:30', poa: 850 },
      { timestamp: '2024-03-15T12:05:00+05:30', poa: null }, // 5 min gap
      { timestamp: '2024-03-15T12:10:00+05:30', poa: null }, // 10 min gap
      { timestamp: '2024-03-15T12:15:00+05:30', poa: 860 },
    ]

    const result = cleanChannelDropouts(
      sampleRecords,
      (r) => r.poa,
      (r, val, meta) => {
        r.poa = val
        r.isImputed = meta.isImputed
        r.isUnusable = meta.isUnusable
      },
      { stepMinutes: 5, maxImputeMinutes: 15 }
    )

    expect(result.cleanedRecords[1].poa).toBe(850)
    expect(result.cleanedRecords[1].isImputed).toBe(true)
    expect(result.cleanedRecords[2].poa).toBe(850)
    expect(result.cleanedRecords[2].isImputed).toBe(true)
    expect(result.cleanedRecords[3].poa).toBe(860)
    expect(result.cleanedRecords[3].isImputed).toBe(false)
  })

  it('marks gaps > 15 min as unusable', () => {
    const sampleRecords = [
      { timestamp: '2024-03-15T12:00:00+05:30', poa: 850 },
      { timestamp: '2024-03-15T12:05:00+05:30', poa: null },
      { timestamp: '2024-03-15T12:10:00+05:30', poa: null },
      { timestamp: '2024-03-15T12:15:00+05:30', poa: null },
      { timestamp: '2024-03-15T12:20:00+05:30', poa: null }, // 20 min gap (> 15m)
      { timestamp: '2024-03-15T12:25:00+05:30', poa: 870 },
    ]

    const result = cleanChannelDropouts(
      sampleRecords,
      (r) => r.poa,
      (r, val, meta) => {
        r.poa = val
        r.isImputed = meta.isImputed
        r.isUnusable = meta.isUnusable
      },
      { stepMinutes: 5, maxImputeMinutes: 15 }
    )

    expect(result.cleanedRecords[1].isUnusable).toBe(true)
    expect(result.cleanedRecords[4].isUnusable).toBe(true)
  })
})

describe('Sanity Engine: Physical Ranges & Sanity Report', () => {
  it('generates unified health score and captures out of range issues', () => {
    const plant = createPlant()
    const weather = generateWeather(plant, '2024-03-15', 1, 5, 42)
    const telemetry = generateCleanTelemetry(plant, weather)

    // Inject out of range heatsink temp
    telemetry.records[100].inverters['INV-01'].heatsinkTemp = 135.0 // exceeds 110 °C

    const report = generateSanityReport(telemetry)
    expect(report.overallHealthScore).toBeLessThanOrEqual(100)
    expect(report.issues.some((i) => i.type === 'out_of_range' && i.channel === 'heatsinkTemp')).toBe(true)
  })
})
