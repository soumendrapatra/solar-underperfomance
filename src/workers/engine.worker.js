/**
 * Web Worker for Kiran RCA Engine.
 * Runs heavy telemetry simulation, physical digital twin modeling,
 * sanity checks, and diagnostics off the main UI thread.
 *
 * Message protocol:
 * In:  { id: string, type: 'simulate' | 'diagnose' | 'benchmark', payload: object }
 * Out: { id: string, stage: string, pct: number } (progress updates)
 * Out: { id: string, status: 'done', result: object } (final response)
 * Out: { id: string, status: 'error', error: string } (on exception)
 *
 * Pure JavaScript, Web Worker context.
 */

import { runScenario } from '../engine/simulator/scenarios.js'
import { runDiagnosis } from '../engine/index.js'
import { createPortfolio, createPlant } from '../engine/simulator/plantFactory.js'

self.onmessage = async function (e) {
  const { id, type, payload = {} } = e.data || {}
  if (!id) return

  const postProgress = (stage, pct) => {
    self.postMessage({ id, stage, pct })
  }

  try {
    switch (type) {
      case 'simulate': {
        postProgress('Initializing simulation', 10)
        const scenarioName = payload.scenario || 'baseline_clear_week'
        postProgress('Generating synthetic weather & telemetry', 40)
        const telemetry = runScenario(scenarioName, payload.options || {})
        postProgress('Simulation complete', 100)
        self.postMessage({ id, status: 'done', result: telemetry })
        break
      }

      case 'diagnose': {
        postProgress('Sanity & sensor QC', 15)
        const plant = payload.plant || createPlant()
        const telemetry = payload.telemetry
        if (!telemetry) {
          throw new Error('Telemetry container is required for diagnosis')
        }

        postProgress('Physics twin & expected baseline', 35)
        postProgress('Transient filtering & feature extraction', 55)
        postProgress('Rule fingerprinting & ML fusion', 75)
        postProgress('Loss waterfall & action planning', 90)

        const diagnosis = runDiagnosis(plant, telemetry, payload.settings || {})
        postProgress('Diagnosis complete', 100)
        self.postMessage({ id, status: 'done', result: diagnosis })
        break
      }

      case 'benchmark': {
        postProgress('Running engine benchmark', 20)
        const plant = createPlant()
        const sim = runScenario('everything_bad_week', { days: 7 })
        postProgress('Benchmarking diagnosis', 60)
        const t0 = performance.now()
        const diag = runDiagnosis(plant, sim)
        const durationMs = Math.round((performance.now() - t0) * 10) / 10
        postProgress('Benchmark complete', 100)

        self.postMessage({
          id,
          status: 'done',
          result: {
            durationMs,
            recordsProcessed: sim.records.length,
            timings: diag.timings,
          },
        })
        break
      }

      default:
        throw new Error(`Unknown worker message type: "${type}"`)
    }
  } catch (err) {
    self.postMessage({
      id,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
