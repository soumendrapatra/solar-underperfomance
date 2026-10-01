import { describe, it, expect } from 'vitest'
import {
  fuseDiagnoses,
  getConfidenceLabel,
} from '../../engine/diagnostics/fusion.js'
import {
  disaggregateYieldLosses,
} from '../../engine/diagnostics/disaggregate.js'
import {
  generateWorkOrders,
} from '../../engine/prescriptive/actionPlanner.js'
import {
  runDiagnosis,
} from '../../engine/index.js'
import {
  runScenario,
} from '../../engine/simulator/scenarios.js'
import {
  createPlant,
} from '../../engine/simulator/plantFactory.js'

describe('Fusion & Multi-Label Diagnostics', () => {
  it('overlap scenario returns both modes (multi-label detection above 0.35)', () => {
    const ruleScores = {
      soiling: 0.78,
      inverter_thermal_derating: 0.85,
      string_open_circuit: 0.05,
    }

    const mlProbs = {
      soiling: 0.82,
      inverter_thermal_derating: 0.90,
      string_open_circuit: 0.02,
    }

    const qcMeta = { imputedPct: 2.0, transientExcludedPct: 5.0 }

    const fused = fuseDiagnoses(ruleScores, mlProbs, qcMeta, { threshold: 0.35 })

    expect(fused.length).toBeGreaterThanOrEqual(2)
    const modes = fused.map((m) => m.mode)
    expect(modes).toContain('soiling')
    expect(modes).toContain('inverter_thermal_derating')

    const derate = fused.find((m) => m.mode === 'inverter_thermal_derating')
    expect(derate.confidence).toBeGreaterThan(0.75)
    expect(derate.confidenceLabel).toBe('High')
  })

  it('curtailment scenario produces zero hardware tickets', () => {
    const ruleScores = {
      grid_curtailment: 0.92,
      inverter_clipping: 0.80,
    }
    const mlProbs = {
      grid_curtailment: 0.95,
      inverter_clipping: 0.85,
    }

    const fused = fuseDiagnoses(ruleScores, mlProbs, {}, { threshold: 0.35 })
    expect(fused.length).toBeGreaterThanOrEqual(1)

    for (const item of fused) {
      expect(item.category).toBe('not_equipment_fault')
      expect(item.isHardwareTicket).toBe(false)
    }

    const workOrders = generateWorkOrders(fused, { overallLossPct: 0.25, lostKWh: 800 })
    expect(workOrders.length).toBe(0)
  })
})

describe('Waterfall Disaggregation', () => {
  it('waterfall parts sum to total within 0.1 kWh', () => {
    const plant = createPlant()
    const sim = runScenario('soiling_plus_derating', { plant, days: 3 })
    const result = disaggregateYieldLosses(sim)

    const wf = result.plantWaterfall
    expect(wf.totalGapKwh).toBeGreaterThan(0)

    const partsSum = wf.items.reduce((sum, item) => sum + item.kwh, 0)
    expect(Math.abs(partsSum - wf.totalGapKwh)).toBeLessThan(0.1)

    for (const invId in result.inverterWaterfalls) {
      const invWf = result.inverterWaterfalls[invId]
      const invPartsSum = invWf.items.reduce((s, it) => s + it.kwh, 0)
      expect(Math.abs(invPartsSum - invWf.totalGapKwh)).toBeLessThan(0.1)
    }
  })
})

describe('End-to-End runDiagnosis Pipeline', () => {
  it('executes full pipeline and returns diagnostic object with per-stage timings', () => {
    const plant = createPlant()
    const sim = runScenario('string_faults_block_b', { plant, days: 2 })

    const diagnosis = runDiagnosis(plant, sim, { tariff: 3.15, seed: 1234 })

    expect(diagnosis.summary).toBeDefined()
    expect(diagnosis.workOrders).toBeDefined()
    expect(diagnosis.waterfall).toBeDefined()
    expect(diagnosis.timings).toBeDefined()

    expect(diagnosis.timings.sanityMs).toBeGreaterThanOrEqual(0)
    expect(diagnosis.timings.expectedMs).toBeGreaterThanOrEqual(0)
    expect(diagnosis.timings.yieldGapMs).toBeGreaterThanOrEqual(0)
    expect(diagnosis.timings.transientMs).toBeGreaterThanOrEqual(0)
    expect(diagnosis.timings.rulesMlMs).toBeGreaterThanOrEqual(0)
    expect(diagnosis.timings.fusionMs).toBeGreaterThanOrEqual(0)
    expect(diagnosis.timings.disaggregateMs).toBeGreaterThanOrEqual(0)
    expect(diagnosis.timings.prescriptionsMs).toBeGreaterThanOrEqual(0)
    expect(diagnosis.timings.totalMs).toBeGreaterThan(0)
  })
})
