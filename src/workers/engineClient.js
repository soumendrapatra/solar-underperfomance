/**
 * Asynchronous Client for the Kiran RCA Engine.
 * Wraps Web Worker execution in clean Promises with request tracking and progress events.
 * Provides seamless main-thread fallback if Web Workers are unavailable or restricted.
 * Pure JavaScript.
 */

let reqCounter = 0

// Main-thread fallback implementation
async function runOnMainThread(type, payload, onProgress) {
  switch (type) {
    case 'simulate': {
      onProgress?.('Generating simulation', 30)
      const { runScenario } = await import('../engine/simulator/scenarios.js')
      const scenarioName = payload.scenario || 'baseline_clear_week'
      onProgress?.('Simulating telemetry', 70)
      const telemetry = runScenario(scenarioName, payload.options || {})
      onProgress?.('Complete', 100)
      return telemetry
    }

    case 'diagnose': {
      onProgress?.('Initializing diagnosis', 20)
      const { runDiagnosis } = await import('../engine/index.js')
      const { createPlant } = await import('../engine/simulator/plantFactory.js')
      const plant = payload.plant || createPlant()
      onProgress?.('Processing physics & diagnostics', 60)
      const diagnosis = runDiagnosis(plant, payload.telemetry, payload.settings || {})
      onProgress?.('Complete', 100)
      return diagnosis
    }

    case 'benchmark': {
      onProgress?.('Running benchmark', 50)
      const { runScenario } = await import('../engine/simulator/scenarios.js')
      const { runDiagnosis } = await import('../engine/index.js')
      const { createPlant } = await import('../engine/simulator/plantFactory.js')
      const plant = createPlant()
      const sim = runScenario('everything_bad_week', { days: 7 })
      const t0 = performance.now()
      const diag = runDiagnosis(plant, sim)
      const durationMs = Math.round((performance.now() - t0) * 10) / 10
      onProgress?.('Complete', 100)
      return {
        durationMs,
        recordsProcessed: sim.records.length,
        timings: diag.timings,
      }
    }

    default:
      throw new Error(`Unknown operation: ${type}`)
  }
}

class EngineClient {
  constructor() {
    this.worker = null
    this.pending = new Map()
    this.isWorkerSupported = typeof window !== 'undefined' && typeof window.Worker !== 'undefined'
    this.initWorker()
  }

  initWorker() {
    if (!this.isWorkerSupported) return

    try {
      // Vite worker import syntax
      this.worker = new Worker(new URL('./engine.worker.js', import.meta.url), {
        type: 'module',
      })

      this.worker.onmessage = (e) => {
        const { id, stage, pct, status, result, error } = e.data || {}
        if (!id || !this.pending.has(id)) return

        const entry = this.pending.get(id)

        // Progress notification
        if (stage !== undefined && pct !== undefined) {
          entry.onProgress?.(stage, pct)
          return
        }

        // Final response
        this.pending.delete(id)
        if (status === 'done') {
          entry.resolve(result)
        } else {
          entry.reject(new Error(error || 'Worker execution failed'))
        }
      }

      this.worker.onerror = (err) => {
        console.warn('[EngineClient] Worker error, falling back to main-thread execution:', err)
        // Reject all pending and discard worker
        for (const [_id, entry] of this.pending.entries()) {
          entry.reject(new Error(err.message || 'Worker thread crashed'))
        }
        this.pending.clear()
        this.worker = null
        this.isWorkerSupported = false
      }
    } catch (err) {
      console.warn('[EngineClient] Web Worker initialization failed, falling back to main thread:', err)
      this.worker = null
      this.isWorkerSupported = false
    }
  }

  /**
   * Sends a command to the engine (worker or main thread).
   * @param {'simulate' | 'diagnose' | 'benchmark'} type
   * @param {object} payload
   * @param {Function} [onProgress]
   * @returns {Promise<any>}
   */
  request(type, payload, onProgress) {
    const id = `req-${Date.now()}-${++reqCounter}`

    if (!this.worker) {
      return runOnMainThread(type, payload, onProgress)
    }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress })
      this.worker.postMessage({ id, type, payload })
    })
  }

  simulate(scenario = 'baseline_clear_week', options = {}, onProgress) {
    return this.request('simulate', { scenario, options }, onProgress)
  }

  diagnose(plant, telemetry, settings = {}, onProgress) {
    return this.request('diagnose', { plant, telemetry, settings }, onProgress)
  }

  benchmark(onProgress) {
    return this.request('benchmark', {}, onProgress)
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.pending.clear()
  }
}

// Export singleton instance and class
export const engineClient = new EngineClient()
export default engineClient
