import { describe, it, expect } from 'vitest'
import {
  detectStuckValues,
  scanTelemetryForStuckValues,
} from '../../engine/sanity/stuckValues.js'
import {
  cleanChannelDropouts,
  fillMissingTimestamps,
} from '../../engine/sanity/dropouts.js'
import {
  validatePhysicalRanges,
} from '../../engine/sanity/physicalRanges.js'
import {
  analyzePyranometerDrift,
} from '../../engine/sanity/pyranometerDrift.js'
import {
  generateSanityReport,
} from '../../engine/sanity/sanityReport.js'
import {
  createPlant,
} from '../../engine/simulator/plantFactory.js'
import {
  generateWeather,
} from '../../engine/simulator/weather.js'
import {
  generateCleanTelemetry,
} from '../../engine/simulator/telemetryGenerator.js'

describe('Sanity Engine: Stuck Sensor Value Detection', () => {
  it('detects a stuck POA sensor value frozen during daylight', () => {
    const plant = createPlant()
    const weather = generateWeather(plant, '2024-03-15', 1, 5, 42)

    const stuckPoaValue = 784.5
    for (let i = 140; i <= 147; i++) {
      weather[i].poa = stuckPoaValue
    }

    const stuckIssues = detectStuckValues(weather, {
      accessor: (r) => r.poa,
      channel: 'poa',
      consecutiveSamples: 6,
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

    const estimationError = Math.abs(result.driftFactor - injectedDrift)
    expect(estimationError).toBeLessThan(0.015)
  })
})

describe('Sanity Engine: Dropouts & Imputation', () => {
  it('forward-fills short gaps (<= 15 min) and marks them imputed', () => {
    const sampleRecords = [
      { timestamp: '2024-03-15T12:00:00+05:30', poa: 850 },
      { timestamp: '2024-03-15T12:05:00+05:30', poa: null },
      { timestamp: '2024-03-15T12:10:00+05:30', poa: null },
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
  })
})
