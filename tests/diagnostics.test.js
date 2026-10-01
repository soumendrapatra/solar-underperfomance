import { describe, it, expect } from 'vitest'
import {
  calculateYieldGap,
} from '../src/engine/diagnostics/yieldGap.js'
import {
  filterTransients,
} from '../src/engine/diagnostics/transientFilter.js'
import {
  evaluatePersistence,
  FAULT_PERSISTENCE_RULES,
} from '../src/engine/diagnostics/persistenceGate.js'
import {
  runDiagnostics,
} from '../src/engine/diagnostics/diagnosticsRunner.js'
import {
  runScenario,
} from '../src/engine/simulator/scenarios.js'
import {
  createPlant,
} from '../src/engine/simulator/plantFactory.js'
import {
  generateWeather,
} from '../src/engine/simulator/weather.js'
import {
  generateCleanTelemetry,
} from '../src/engine/simulator/telemetryGenerator.js'

describe('Diagnostics Engine: False-Positive Protection & Scenarios', () => {
  it('the "cloudy_monsoon_day" scenario must produce zero raised candidates', () => {
    // Run the monsoon scenario (rich in cloud transients)
    const sim = runScenario('cloudy_monsoon_day', { days: 3 })
    const results = runDiagnostics(sim)

    // Crucial assertion: despite high irradiance variability, zero fault candidates must be raised
    expect(results.raisedFaults.length).toBe(0)
    expect(results.isCleanRun).toBe(true)

    // Transient filter should have excluded transient intervals
    expect(results.transientMetrics.overallExcludedPct).toBeGreaterThan(0)
  })

  it('the "string_faults_block_b" scenario must still raise its candidates', () => {
    // Run scenario with persistent string faults in Block B (INV-02)
    const sim = runScenario('string_faults_block_b', { days: 3 })
    const results = runDiagnostics(sim)

    // Crucial assertion: persistent real faults must survive filtering and be raised
    expect(results.raisedFaults.length).toBeGreaterThanOrEqual(1)

    // Confirm that INV-02 string open circuit is among the raised faults
    const openCircuitFault = results.raisedFaults.find(
      (f) => f.faultType === 'string_open_circuit' && f.assetId.includes('INV-02')
    )
    expect(openCircuitFault).toBeDefined()
    expect(openCircuitFault.isRaised).toBe(true)
    expect(openCircuitFault.consecutiveStableMinutes).toBeGreaterThanOrEqual(45)
  })
})

describe('Diagnostics Engine: Yield Gap Calculation', () => {
  it('ignores dawn/dusk samples where POA < 100 W/m2 and samples marked unusable', () => {
    const plant = createPlant()
    const weather = [
      { timestamp: '2024-03-15T06:00:00+05:30', poa: 40, tAmb: 24, wind: 2 },  // Dawn: POA < 100
      { timestamp: '2024-03-15T12:00:00+05:30', poa: 900, tAmb: 36, wind: 3 }, // Midday: valid
      { timestamp: '2024-03-15T13:00:00+05:30', poa: 950, tAmb: 38, wind: 3, isUnusable: true }, // Marked unusable
    ]

    const telemetry = generateCleanTelemetry(plant, weather)
    // Mark record 2 unusable
    telemetry.records[2].weather.isUnusable = true

    const result = calculateYieldGap(telemetry, { minPoa: 100.0 })

    expect(result.timeSeries[0].isIgnored).toBe(true)
    expect(result.timeSeries[0].ignoreReason).toBe('poa_below_100')

    expect(result.timeSeries[1].isIgnored).toBe(false)
    expect(result.timeSeries[1].plantPact).toBeGreaterThan(0)

    expect(result.timeSeries[2].isIgnored).toBe(true)
    expect(result.timeSeries[2].ignoreReason).toBe('sanity_unusable')
  })
})

describe('Diagnostics Engine: Transient Filter', () => {
  it('flags sharp irradiance swings (|dPOA/dt| > 150 W/m2) and accounts for inverter lag', () => {
    const plant = createPlant()
    const weather = [
      { timestamp: '2024-03-15T11:55:00+05:30', poa: 900, tAmb: 35, wind: 2 },
      { timestamp: '2024-03-15T12:00:00+05:30', poa: 600, tAmb: 35, wind: 2 }, // Drop of 300 W/m² in 5 min
      { timestamp: '2024-03-15T12:05:00+05:30', poa: 620, tAmb: 35, wind: 2 },
    ]

    const telemetry = generateCleanTelemetry(plant, weather)
    const result = filterTransients(telemetry)

    // Step 1 should be marked transient due to 300 W/m² gradient > 150
    expect(result.filteredRecords[1].weather.isTransient).toBe(true)
    expect(result.filteredRecords[1].weather.isStable).toBe(false)
    expect(result.filteredRecords[1].weather.dPoaDt).toBe(300)
  })
})
