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
    name: 'Normal Operation (Extra Class Building)',
    description: 'Optimal clear-sky conditions with zero equipment faults across rooftop strings.',
    seed: 1001,
    days: 7,
    startDate: '2024-03-15',
    faults: [],
  },

  cloudy_monsoon_day: {
    id: 'cloudy_monsoon_day',
    name: 'Cloud Transient (No Maintenance Required)',
    description: 'Natural passing cloud dynamics with sharp irradiance fluctuations. Filtered automatically to avoid false alarms.',
    seed: 2002,
    days: 7,
    startDate: '2024-07-20',
    faults: [],
  },

  soiling_plus_derating: {
    id: 'soiling_plus_derating',
    name: 'Academic Block Dust Accumulation',
    description: 'Uniform dust and particulate accumulation (-0.35%/day PR decay) across Main Academic Block rooftop panels.',
    seed: 3003,
    days: 7,
    startDate: '2024-04-10',
    faults: [
      { type: 'soiling', options: { ratePerDay: 0.0035, startDay: 0 } },
    ],
  },

  partial_shading_morning: {
    id: 'partial_shading_morning',
    name: 'Workshop Morning Shading',
    description: 'Repeatable geometric morning shadow from parapet wall over Mechanical Workshop rooftop array (07:30 - 09:30 IST).',
    seed: 4004,
    days: 7,
    startDate: '2024-03-15',
    faults: [
      { type: 'partial_shading', options: { startHour: 7.5, endHour: 9.5, lossFactor: 0.45 } },
    ],
  },

  inverter_thermal_trip: {
    id: 'inverter_thermal_trip',
    name: 'Library Inverter Heating',
    description: 'INV-L1 inverter ventilation restriction causing heatsink temperature to exceed 78°C and throttle AC output.',
    seed: 5005,
    days: 7,
    startDate: '2024-03-15',
    faults: [
      { type: 'inverter_derating', options: { inverterId: 'INV-L1', startDay: 2, capFraction: 0.65 } },
    ],
  },

  string_faults_block_b: {
    id: 'string_faults_block_b',
    name: 'Department Roof String Mismatch',
    description: 'Department Roof Cluster SCB-D1 string 02 open circuit (blown fuse) and sub-array mismatch.',
    seed: 6006,
    days: 7,
    startDate: '2024-03-15',
    faults: [
      { type: 'string_open_circuit', options: { targetString: 'INV-D1/SCB-D1/STR-02', startStepIndex: 140 } },
    ],
  },

  everything_bad_week: {
    id: 'everything_bad_week',
    name: 'Combined Campus Multi-Fault Test',
    description: 'Controlled demonstration of overlapping dust soiling, partial morning shading, and inverter heating.',
    seed: 7007,
    days: 7,
    startDate: '2024-03-15',
    faults: [
      { type: 'soiling', options: { ratePerDay: 0.003, startDay: 0 } },
      { type: 'inverter_derating', options: { inverterId: 'INV-A1', startDay: 2, capFraction: 0.70 } },
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
