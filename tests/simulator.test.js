import { describe, it, expect } from 'vitest'
import {
  createRng,
  mulberry32,
  gaussian,
  between,
  pick,
} from '../src/engine/simulator/rng.js'
import {
  createPlant,
  createPortfolio,
  STANDARD_MODULE,
} from '../src/engine/simulator/plantFactory.js'
import {
  generateWeather,
  CLOUD_STATES,
} from '../src/engine/simulator/weather.js'
import {
  generateCleanTelemetry,
} from '../src/engine/simulator/telemetryGenerator.js'
import {
  injectStringOpenCircuit,
  injectInverterDerating,
  injectCurtailment,
  injectSoiling,
  injectPyranometerDrift,
} from '../src/engine/simulator/faultInjectors.js'
import {
  runScenario,
  SCENARIO_PRESETS,
} from '../src/engine/simulator/scenarios.js'

describe('Simulator Engine: RNG & Statistical Helpers', () => {
  it('mulberry32 determinism with the same seed', () => {
    const seed = 98765
    const rngA = mulberry32(seed)
    const rngB = mulberry32(seed)

    for (let i = 0; i < 50; i++) {
      expect(rngA()).toBe(rngB())
    }
  })

  it('gaussian, between, and pick produce expected distributions', () => {
    const rng = createRng(42)
    const samples = Array.from({ length: 500 }, () => rng.gaussian(10, 2))
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length
    expect(mean).toBeGreaterThan(9.5)
    expect(mean).toBeLessThan(10.5)

    const b = rng.between(5, 15)
    expect(b).toBeGreaterThanOrEqual(5)
    expect(b).toBeLessThan(15)

    const choice = rng.pick(['alpha', 'beta', 'gamma'])
    expect(['alpha', 'beta', 'gamma']).toContain(choice)
  })
})

describe('Simulator Engine: Plant Asset Hierarchy & Portfolio', () => {
  it('creates Bhadla Block C with 8 inverters, 2 MPPTs, 2 SCBs/MPPT, 12 strings/SCB', () => {
    const plant = createPlant()
    expect(plant.name).toBe('Bhadla Block C')
    expect(plant.inverters.length).toBe(8)
    expect(plant.acCapacityKw).toBe(10000) // 10 MWac
    expect(plant.dcCapacityKwp).toBe(12400) // 12.4 MWp DC
    expect(plant.dcAcRatio).toBeCloseTo(1.24, 2)

    const inv = plant.inverters[0]
    expect(inv.id).toBe('INV-01')
    expect(inv.pAcRated).toBe(1250)
    expect(inv.mppts.length).toBe(2)

    const mppt = inv.mppts[0]
    expect(mppt.combinerBoxes.length).toBe(2)

    const scb = mppt.combinerBoxes[0]
    expect(scb.strings.length).toBe(12)
    expect(scb.strings[0].modulesCount).toBe(28)
    expect(scb.strings[0].module.pNom).toBe(545)
    expect(scb.strings[0].module.voc).toBe(49.6)
    expect(scb.strings[0].module.vmp).toBe(41.8)
    expect(scb.strings[0].module.imp).toBe(13.04)
  })

  it('createPortfolio returns 4 distinct regional plants', () => {
    const portfolio = createPortfolio()
    expect(portfolio.length).toBe(4)
    const names = portfolio.map((p) => p.name)
    expect(names).toContain('Bhadla Block C')
    expect(names).toContain('Pavagada P4')
    expect(names).toContain('Charanka Rooftop Cluster')
    expect(names).toContain('Kurnool East')
  })
})

describe('Simulator Engine: Weather & Irradiance', () => {
  it('determinism with the same seed in generateWeather', () => {
    const plant = createPlant()
    const weather1 = generateWeather(plant, '2024-03-15', 2, 5, 555)
    const weather2 = generateWeather(plant, '2024-03-15', 2, 5, 555)

    expect(weather1.length).toBe(weather2.length)
    expect(weather1[50].ghi).toBe(weather2[50].ghi)
    expect(weather1[50].poa).toBe(weather2[50].poa)
    expect(weather1[100].tAmb).toBe(weather2[100].tAmb)
  })

  it('no negative irradiance at night (GHI >= 0, POA >= 0, and strictly 0 at night)', () => {
    const plant = createPlant()
    const weather = generateWeather(plant, '2024-03-15', 3, 5, 777)

    for (const row of weather) {
      // Irradiance must never be negative
      expect(row.ghi).toBeGreaterThanOrEqual(0)
      expect(row.poa).toBeGreaterThanOrEqual(0)

      // When sun is below horizon or solar elevation is 0
      if (row.solarElevation <= 0) {
        expect(row.ghi).toBe(0)
        expect(row.poa).toBe(0)
        expect(row.tModule).toBe(row.tAmb) // NOCT model cell temp equals ambient at night
      }

      // Valid Markov cloud state
      expect(Object.values(CLOUD_STATES)).toContain(row.cloudState)
    }
  })

  it('ambient temperature stays within realistic physical range', () => {
    const plant = createPlant()
    const weather = generateWeather(plant, '2024-03-15', 3, 5, 888)

    const minTemp = Math.min(...weather.map((w) => w.tAmb))
    const maxTemp = Math.max(...weather.map((w) => w.tAmb))

    // Minimum around dawn ~23-26°C, maximum afternoon ~39-43°C
    expect(minTemp).toBeGreaterThanOrEqual(21)
    expect(maxTemp).toBeLessThanOrEqual(44)
  })
})

describe('Simulator Engine: Clean Telemetry & Inverter Clipping', () => {
  it('clean telemetry generates valid electrical values for all 8 inverters', () => {
    const plant = createPlant()
    const weather = generateWeather(plant, '2024-03-15', 1, 5, 42)
    const sim = generateCleanTelemetry(plant, weather, { includeStrings: true })

    expect(sim.records.length).toBe(288) // 1 day at 5-min intervals
    const noonRec = sim.records[156] // ~13:00 IST peak sunshine

    expect(noonRec.weather.poa).toBeGreaterThan(800)

    for (let i = 1; i <= 8; i++) {
      const invId = `INV-${String(i).padStart(2, '0')}`
      const inv = noonRec.inverters[invId]
      expect(inv).toBeDefined()
      expect(inv.pAc).toBeGreaterThan(800)
      expect(inv.pAc).toBeLessThanOrEqual(1250) // Capped at rated 1250 kWac
      expect(inv.heatsinkTemp).toBeGreaterThan(inv.weather?.tAmb || 40)
      expect(inv.gridSetpointPct).toBe(100)

      // Strings check
      const scb1 = inv.scbs['SCB-01']
      expect(scb1.strings.length).toBe(12)
      expect(scb1.strings[0]).toBeGreaterThan(7.0) // Healthy midday current
    }
  })
})

describe('Simulator Engine: Fault Injectors', () => {
  it('string open circuit current < 0.3 A on targeted string', () => {
    const plant = createPlant()
    const weather = generateWeather(plant, '2024-03-15', 1, 5, 42)
    const cleanSim = generateCleanTelemetry(plant, weather, { includeStrings: true })

    const target = 'INV-01/SCB-01/S04'
    const faultSim = injectStringOpenCircuit(cleanSim, {
      targetString: target,
      startStepIndex: 120,
    })

    expect(faultSim.labels.length).toBe(1)
    expect(faultSim.labels[0].faultType).toBe('string_open_circuit')
    expect(faultSim.labels[0].assetId).toBe(target)

    // Check step 156 (solar noon)
    const rec = faultSim.records[156]
    const scb = rec.inverters['INV-01'].scbs['SCB-01']

    // Target string S04 is index 3
    const openCurrent = scb.strings[3]
    expect(openCurrent).toBeLessThan(0.3) // Crucial assertion: current < 0.3 A

    // Adjacent healthy string S03 must be generating normally (> 8 A)
    const healthyCurrent = scb.strings[2]
    expect(healthyCurrent).toBeGreaterThan(8.0)
  })

  it('inverter thermal derating caps output when heatsink > 72 C', () => {
    const plant = createPlant()
    const weather = generateWeather(plant, '2024-03-15', 3, 5, 100)
    const cleanSim = generateCleanTelemetry(plant, weather)

    const faultSim = injectInverterDerating(cleanSim, {
      inverterId: 'INV-02',
      startDay: 1,
      capFraction: 0.76,
    })

    const deratedSteps = faultSim.records.filter((r) => {
      const inv = r.inverters['INV-02']
      return inv.status === 'DERATED'
    })

    expect(deratedSteps.length).toBeGreaterThan(0)
    for (const step of deratedSteps) {
      const inv = step.inverters['INV-02']
      expect(inv.heatsinkTemp).toBeGreaterThan(72)
      expect(inv.pAc).toBeLessThanOrEqual(1250 * 0.76 + 0.1)
    }
  })

  it('curtailment enforces active export limit and sets status', () => {
    const plant = createPlant()
    const weather = generateWeather(plant, '2024-03-15', 2, 5, 200)
    const cleanSim = generateCleanTelemetry(plant, weather)

    const faultSim = injectCurtailment(cleanSim, {
      setpointPct: 60,
      startHour: 12.0,
      endHour: 14.0,
      days: [0, 1],
    })

    const curtailedRecord = faultSim.records.find((r) => {
      const hour = (r.stepIndex % 288) * 5 / 60
      return hour >= 12.5 && hour <= 13.5 && r.weather.poa > 500
    })

    expect(curtailedRecord).toBeDefined()
    const inv = curtailedRecord.inverters['INV-01']
    expect(inv.gridSetpointPct).toBe(60)
    expect(inv.pAc).toBeLessThanOrEqual(1250 * 0.60 + 0.1)
    expect(inv.status).toBe('CURTAILED')
  })
})

describe('Simulator Engine: Scenarios Presets & Repeatability', () => {
  it('preset scenarios are deterministic across independent runs', () => {
    const simA = runScenario('string_faults_block_b', { days: 2 })
    const simB = runScenario('string_faults_block_b', { days: 2 })

    expect(simA.records.length).toBe(simB.records.length)
    expect(simA.records[100].weather.poa).toBe(simB.records[100].weather.poa)
    expect(simA.records[100].inverters['INV-01'].pAc).toBe(simB.records[100].inverters['INV-01'].pAc)
    expect(simA.labels.length).toBe(simB.labels.length)
  })

  it('cloudy_monsoon_day produces zero equipment fault labels', () => {
    const sim = runScenario('cloudy_monsoon_day', { days: 2 })
    const equipmentFaults = sim.labels.filter((l) => l.isFault === true)
    expect(equipmentFaults.length).toBe(0)
  })
})
