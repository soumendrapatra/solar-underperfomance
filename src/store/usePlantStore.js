/**
 * Plant & Fleet Store (Zustand).
 * Manages the multi-plant portfolio, active plant selection, telemetry cache,
 * diagnostic results, scenario execution, and real-time stage progress.
 */

import { create } from 'zustand'
import { createPortfolio, createPlant } from '../engine/simulator/plantFactory.js'
import { engineClient } from '../workers/engineClient.js'
import { useWorkOrderStore } from './useWorkOrderStore.js'

// Initial scenarios mapped across the 5 GCE Kalahandi campus solar zones
export const DEFAULT_PORTFOLIO_SCENARIOS = {
  'academic-block': 'soiling_plus_derating',
  'mechanical-workshop': 'shading_morning',
  'library-hall': 'inverter_thermal_derating',
  'extra-class-building': 'baseline_clear_week',
  'department-roof-cluster': 'string_fault_single',
}

export const usePlantStore = create((set, get) => ({
  portfolio: createPortfolio(),
  selectedPlantId: 'academic-block',
  telemetryCache: {},
  diagnoses: {},
  activeScenarios: { ...DEFAULT_PORTFOLIO_SCENARIOS },
  loading: false,
  stageProgress: { stage: '', pct: 0 },
  initialized: false,

  setSelectedPlantId: (plantId) => set({ selectedPlantId: plantId }),

  /**
   * Initializes the 4-plant portfolio on application boot, generating
   * realistic scenarios and full diagnoses for each plant.
   */
  loadPortfolio: async () => {
    if (get().loading) return
    set({ loading: true, stageProgress: { stage: 'Bootstrapping portfolio assets', pct: 5 } })

    const portfolio = createPortfolio()
    const telemetryCache = { ...get().telemetryCache }
    const diagnoses = { ...get().diagnoses }

    try {
      for (let i = 0; i < portfolio.length; i++) {
        const plant = portfolio[i]
        const scenario = DEFAULT_PORTFOLIO_SCENARIOS[plant.id] || 'baseline_clear_week'
        const basePct = Math.round(10 + (i / portfolio.length) * 80)

        set({
          stageProgress: {
            stage: `Simulating ${plant.name} (${scenario.replace(/_/g, ' ')})`,
            pct: basePct,
          },
        })

        // 1. Simulate telemetry
        const telemetry = await engineClient.simulate(scenario, {
          plant,
          days: 7,
          includeStrings: true, // Small-scale campus arrays can include full string detail
        })

        telemetryCache[plant.id] = telemetry

        // 2. Run initial diagnosis
        const diagnosis = await engineClient.diagnose(plant, telemetry, {
          tariff: plant.tariffInrPerKwh || 6.50,
        })

        diagnoses[plant.id] = diagnosis

        // Automatically populate work order queue with newly diagnosed issues
        if (diagnosis.workOrders && diagnosis.workOrders.length > 0) {
          useWorkOrderStore.getState().createFromDiagnosis(plant.id, diagnosis.workOrders)
        }
      }

      set({
        portfolio,
        telemetryCache,
        diagnoses,
        loading: false,
        initialized: true,
        stageProgress: { stage: 'Fleet ready', pct: 100 },
      })
    } catch (err) {
      console.error('[usePlantStore] Error loading portfolio:', err)
      set({ loading: false, stageProgress: { stage: 'Error loading portfolio', pct: 0 } })
    }
  },

  /**
   * Runs a new scenario on a specified plant and automatically triggers rediagnosis.
   */
  runScenario: async (plantId, scenarioName, options = {}) => {
    const plant = get().portfolio.find((p) => p.id === plantId) || createPlant()
    set({
      loading: true,
      stageProgress: { stage: `Simulating ${scenarioName}...`, pct: 15 },
      activeScenarios: { ...get().activeScenarios, [plantId]: scenarioName },
    })

    try {
      // 1. Simulate
      const telemetry = await engineClient.simulate(
        scenarioName,
        { plant, days: options.days || 7, ...options },
        (stage, pct) => set({ stageProgress: { stage, pct: Math.round(pct * 0.5) } })
      )

      // 2. Diagnose
      const diagnosis = await engineClient.diagnose(
        plant,
        telemetry,
        { tariff: plant.tariffInrPerKwh || 3.15 },
        (stage, pct) => set({ stageProgress: { stage, pct: Math.round(50 + pct * 0.5) } })
      )

      // 3. Update store
      set((s) => ({
        telemetryCache: { ...s.telemetryCache, [plantId]: telemetry },
        diagnoses: { ...s.diagnoses, [plantId]: diagnosis },
        loading: false,
        stageProgress: { stage: 'Complete', pct: 100 },
      }))

      if (diagnosis.workOrders?.length > 0) {
        useWorkOrderStore.getState().createFromDiagnosis(plantId, diagnosis.workOrders)
      }

      return { telemetry, diagnosis }
    } catch (err) {
      console.error(`[usePlantStore] Failed running scenario on ${plantId}:`, err)
      set({ loading: false, stageProgress: { stage: 'Failed', pct: 0 } })
      throw err
    }
  },

  /**
   * Re-evaluates diagnosis on existing cached telemetry.
   */
  rediagnose: async (plantId, settings = {}) => {
    const plant = get().portfolio.find((p) => p.id === plantId) || createPlant()
    const telemetry = get().telemetryCache[plantId]
    if (!telemetry) return

    set({ loading: true, stageProgress: { stage: 'Re-evaluating diagnosis', pct: 20 } })

    try {
      const diagnosis = await engineClient.diagnose(
        plant,
        telemetry,
        { tariff: plant.tariffInrPerKwh || 3.15, ...settings },
        (stage, pct) => set({ stageProgress: { stage, pct } })
      )

      set((s) => ({
        diagnoses: { ...s.diagnoses, [plantId]: diagnosis },
        loading: false,
        stageProgress: { stage: 'Complete', pct: 100 },
      }))

      return diagnosis
    } catch (err) {
      console.error(`[usePlantStore] Failed rediagnosing ${plantId}:`, err)
      set({ loading: false, stageProgress: { stage: 'Failed', pct: 0 } })
      throw err
    }
  },
}))
