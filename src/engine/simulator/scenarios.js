/**
 * Preset simulation scenarios combining weather and fault injection.
 * Each scenario has a fixed seed for repeatable deterministic demos.
 * Pure JavaScript, no external dependencies.
 */

import { createPlant } from './plantFactory.js'
import { generateWeather } from './weather.js'
import { generateCleanTelemetry } from './telemetryGenerator.js'
import {
  injectSoiling,
  injectPartialShading,
  injectInverterDerating,
  injectClipping,
  injectStringOpenCircuit,
  injectBypassDiodeFailure,
  injectCurtailment,
  injectPyranometerDrift,
} from './faultInjectors.js'

/**
 * Scenario configurations with fixed seeds and fault combinations.
 */
export const SCENARIO_PRESETS = {
  baseline_clear_week: {
    id: 'baseline_clear_week',
    name: 'Baseline Clear Week',
    description: 'Optimal high-irradiance conditions with zero equipment faults. Normal clipping at solar noon.',
    seed: 1001,
    days: 7,
    startDate: '2024-03-15',
    faults: [],
  },

  cloudy_monsoon_day: {
    id: 'cloudy_monsoon_day',
    name: 'Cloudy Monsoon / Heavy Transients',
    description: 'High cloud dynamics with sharp 2-15 minute transients. Zero equipment faults. Must not trigger false alarms.',
    seed: 2002,
    days: 7,
    startDate: '2024-07-20',
    faults: [],
  },

  soiling_plus_derating: {
    id: 'soiling_plus_derating',
    name: 'Soiling + Inverter Thermal Derating',
    description: 'Progressive dry dust soiling accumulating at 0.3 %/day plus INV-03 thermal derating (fan failure).',
    seed: 3003,
    days: 7,
    startDate: '2024-04-10',
    faults: [
      { type: 'soiling', options: { ratePerDay: 0.003, startDay: 0 } },
      { type: 'inverter_derating', options: { inverterId: 'INV-03', startDay: 2, capFraction: 0.75 } },
    ],
  },

  string_faults_block_b: {
    id: 'string_faults_block_b',
    name: 'String Faults (Open Circuit & Bypass Diode)',
    description: 'INV-02 combiner faults: open-circuit string S03 and blown bypass diode on string S09.',
    seed: 4004,
    days: 7,
    startDate: '2024-03-15',
    faults: [
      { type: 'string_open_circuit', options: { targetString: 'INV-02/SCB-01/S03', startStepIndex: 140 } },
      { type: 'bypass_diode_failure', options: { targetString: 'INV-02/SCB-02/S09', failedDiodes: 1, startStepIndex: 80 } },
    ],
  },

  curtailment_afternoon: {
    id: 'curtailment_afternoon',
    name: 'Grid Curtailment Afternoon',
    description: 'DISCOM grid export restriction capping all inverters to 55 % between 12:00 and 15:00.',
    seed: 5005,
    days: 7,
    startDate: '2024-03-15',
    faults: [
      { type: 'curtailment', options: { setpointPct: 55, startHour: 12.0, endHour: 15.0, days: [2, 3, 4] } },
    ],
  },

  sensor_drift_wms1: {
    id: 'sensor_drift_wms1',
    name: 'Pyranometer Calibration Drift (WMS-01)',
    description: 'Weather station POA sensor drifts downward by 10 % while inverters operate normally.',
    seed: 6006,
    days: 7,
    startDate: '2024-03-15',
    faults: [
      { type: 'pyranometer_drift', options: { driftRatePerDay: 0.016, maxDrift: 0.10, startDay: 1 } },
    ],
  },

  everything_bad_week: {
    id: 'everything_bad_week',
    name: 'Compound Multi-Fault Week',
    description: 'Complex overlapping faults: soiling, string open circuit, inverter derating, curtailment, and sensor drift.',
    seed: 7007,
    days: 7,
    startDate: '2024-03-15',
    faults: [
      { type: 'soiling', options: { ratePerDay: 0.0025, startDay: 0 } },
      { type: 'string_open_circuit', options: { targetString: 'INV-01/SCB-01/S04', startStepIndex: 200 } },
      { type: 'inverter_derating', options: { inverterId: 'INV-04', startDay: 3, capFraction: 0.72 } },
      { type: 'curtailment', options: { setpointPct: 60, startHour: 12.5, endHour: 14.5, days: [4, 5] } },
      { type: 'pyranometer_drift', options: { driftRatePerDay: 0.012, maxDrift: 0.08, startDay: 1 } },
    ],
  },
}

/**
 * Runs a named or custom simulation scenario deterministically.
 * @param {string|object} preset - Name from SCENARIO_PRESETS or custom config object
 * @param {object} [customOverrides]
 * @returns {object} Full simulation dataset with telemetry records and ground-truth labels
 */
export function runScenario(preset, customOverrides = {}) {
  const config = typeof preset === 'string'
    ? SCENARIO_PRESETS[preset] || SCENARIO_PRESETS.baseline_clear_week
    : preset

  const plant = customOverrides.plant || createPlant(customOverrides.plantConfig)
  const days = customOverrides.days ?? config.days ?? 7
  const startDate = customOverrides.startDate ?? config.startDate ?? '2024-03-15'
  const stepMinutes = customOverrides.stepMinutes ?? 5
  const seed = customOverrides.seed ?? config.seed ?? 42
  const includeStrings = customOverrides.includeStrings ?? true

  // 1. Generate weather
  const weatherRows = generateWeather(plant, startDate, days, stepMinutes, seed)

  // 2. Generate clean electrical baseline telemetry
  let telemetry = generateCleanTelemetry(plant, weatherRows, {
    includeStrings,
    seed,
  })

  // 3. Always detect and label natural inverter clipping
  telemetry = injectClipping(telemetry)

  // 4. Apply configured faults sequentially
  const faults = customOverrides.faults || config.faults || []
  for (const fault of faults) {
    switch (fault.type) {
      case 'soiling':
        telemetry = injectSoiling(telemetry, fault.options)
        break
      case 'partial_shading':
        telemetry = injectPartialShading(telemetry, fault.options)
        break
      case 'inverter_derating':
        telemetry = injectInverterDerating(telemetry, fault.options)
        break
      case 'string_open_circuit':
        telemetry = injectStringOpenCircuit(telemetry, fault.options)
        break
      case 'bypass_diode_failure':
        telemetry = injectBypassDiodeFailure(telemetry, fault.options)
        break
      case 'curtailment':
        telemetry = injectCurtailment(telemetry, fault.options)
        break
      case 'pyranometer_drift':
        telemetry = injectPyranometerDrift(telemetry, fault.options)
        break
      default:
        break
    }
  }

  telemetry.scenario = {
    id: config.id || 'custom',
    name: config.name || 'Custom Scenario',
    description: config.description || '',
    seed,
  }

  return telemetry
}
