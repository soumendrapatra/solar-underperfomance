import { describe, it, expect } from 'vitest'
import {
  calculateSolarPosition,
} from '../src/engine/physics/solarPosition.js'
import {
  calculateCellTemperature,
  isMeasuredBomValid,
  SAPM_OPEN_RACK_GLASS_POLYMER,
} from '../src/engine/physics/cellTemperature.js'
import {
  calculateDcPower,
  calculateStringCurrent,
  calculateStringVoltage,
} from '../src/engine/physics/dcModel.js'
import {
  calculateInverterAcPower,
} from '../src/engine/physics/inverterModel.js'
import {
  expectedForInverter,
  expectedForPlant,
} from '../src/engine/physics/expectedPower.js'

describe('Physics Engine: Solar Position (NOAA)', () => {
  it('Solar elevation at Bhadla local solar noon in June is about 86 deg (within tolerance)', () => {
    // Bhadla coordinates: lat 27.5°N, lon 71.9°E
    // On Summer Solstice (~June 21), local solar noon (hour angle ~ 0) occurs around 12:44 IST
    // (IST meridian is 82.5°E -> 10.6° difference = ~42.4 min offset + EoT ~ -1.5 min)
    const lat = 27.5
    const lon = 71.9

    // Check elevation around solar noon
    const result = calculateSolarPosition(lat, lon, '2024-06-21T12:44:00+05:30')

    // Declination on June 21 is ~23.44°N.
    // Theoretical solar noon zenith = lat - dec = 27.5 - 23.44 = 4.06°
    // Elevation = 90 - 4.06 = 85.94° ≈ 86°
    expect(result.elevation).toBeGreaterThan(85.0)
    expect(result.elevation).toBeLessThan(87.0)
    expect(result.zenith).toBeCloseTo(4.06, 0)
    expect(result.azimuth).toBeGreaterThan(160)
    expect(result.azimuth).toBeLessThan(200)
  })

  it('calculates night-time solar elevation below horizon correctly', () => {
    const result = calculateSolarPosition(27.5, 71.9, '2024-06-21T01:00:00+05:30')
    expect(result.elevation).toBeLessThan(0)
    expect(result.zenith).toBeGreaterThan(90)
  })
})

describe('Physics Engine: SAPM Cell Temperature', () => {
  it('calculates realistic module and cell temperature under sunlight', () => {
    const res = calculateCellTemperature({
      poa: 1000,
      tAmb: 30,
      windSpeed: 2.0,
    })

    // At 1000 W/m², module temp is substantially above ambient (~50-60 °C)
    expect(res.tModule).toBeGreaterThan(30)
    expect(res.tModule).toBeLessThan(65)
    // Cell is hotter than module backsheet by deltaT (~3 °C)
    expect(res.tCell).toBeGreaterThan(res.tModule)
    expect(res.tCell - res.tModule).toBeCloseTo(3.0, 1)
    expect(res.source).toBe('sapm_modeled')
  })

  it('wind cooling lowers module temperature', () => {
    const calm = calculateCellTemperature({ poa: 800, tAmb: 35, windSpeed: 1.0 })
    const windy = calculateCellTemperature({ poa: 800, tAmb: 35, windSpeed: 6.0 })
    expect(windy.tCell).toBeLessThan(calm.tCell)
  })

  it('prefers valid measured back-of-module temperature', () => {
    const res = calculateCellTemperature({
      poa: 800,
      tAmb: 32,
      windSpeed: 2.0,
      measuredBom: 52.4, // Valid measured BOM sensor reading
    })

    expect(res.source).toBe('measured_bom')
    expect(res.tModule).toBe(52.4)
    expect(res.tCell).toBeCloseTo(52.4 + (800 / 1000) * 3.0, 1)
  })

  it('falls back to SAPM when measured BOM fails sanity check', () => {
    const res = calculateCellTemperature({
      poa: 800,
      tAmb: 32,
      windSpeed: 2.0,
      measuredBom: 150, // Physical impossibility
    })

    expect(res.source).toBe('sapm_modeled')
    expect(res.tCell).toBeLessThan(80)
  })
})

describe('Physics Engine: DC Array Model', () => {
  it('Pdc scales linearly with POA at a constant cell temperature', () => {
    const tCell = 45.0
    const pdc0 = 1550 // kWp

    const low = calculateDcPower({ pdc0, poa: 400, tCell })
    const high = calculateDcPower({ pdc0, poa: 800, tCell })

    // Doubling POA from 400 to 800 W/m² must exactly double Pdc
    expect(high.pDc / low.pDc).toBeCloseTo(2.0, 3)
  })

  it('Higher cell temperature lowers Pdc by about 0.35 %/C', () => {
    const pdc0 = 1550 // kWp
    const poa = 1000

    const at25 = calculateDcPower({ pdc0, poa, tCell: 25, gamma: -0.0035 })
    const at35 = calculateDcPower({ pdc0, poa, tCell: 35, gamma: -0.0035 })

    // 10 °C rise with gamma = -0.0035 should reduce power by 3.5%
    const relativeDrop = (at25.pDc - at35.pDc) / at25.pDc
    expect(relativeDrop).toBeCloseTo(0.035, 3)

    // Per degree sensitivity is ~0.35 %/°C
    const pctPerDegree = (relativeDrop / 10) * 100
    expect(pctPerDegree).toBeCloseTo(0.35, 2)
  })

  it('calculates string current and handles night-time zero', () => {
    const currentDay = calculateStringCurrent({ imp: 13.04, poa: 1000, tCell: 25 })
    expect(currentDay).toBeCloseTo(13.04, 1)

    const currentNight = calculateStringCurrent({ imp: 13.04, poa: 0, tCell: 20 })
    expect(currentNight).toBe(0)
  })
})

describe('Physics Engine: PVWatts Inverter Model', () => {
  it('Inverter output never exceeds Pac0', () => {
    const pAc0 = 1250 // kWac

    // Test with extreme DC inputs (1.24x, 2x, 5x overbuild)
    const rated = calculateInverterAcPower({ pDc: 1250 / 0.985, pAc0 })
    const normalOverbuild = calculateInverterAcPower({ pDc: 1550, pAc0 })
    const extremeOverbuild = calculateInverterAcPower({ pDc: 3000, pAc0 })
    const absurdInput = calculateInverterAcPower({ pDc: 100000, pAc0 })

    expect(rated.pAcExpected).toBeLessThanOrEqual(pAc0)
    expect(normalOverbuild.pAcExpected).toBeLessThanOrEqual(pAc0)
    expect(normalOverbuild.pAcExpected).toBe(pAc0) // Clipped at 1250 kW
    expect(normalOverbuild.isClippingExpected).toBe(true)
    expect(normalOverbuild.pAcUnclipped).toBeGreaterThan(pAc0)

    expect(extremeOverbuild.pAcExpected).toBe(pAc0)
    expect(absurdInput.pAcExpected).toBe(pAc0)
  })

  it('exhibits realistic part-load efficiency curve', () => {
    const pAc0 = 1250

    // Full load efficiency is near nominal 0.985
    const fullLoad = calculateInverterAcPower({ pDc: 1250 / 0.985, pAc0, etaNom: 0.985 })
    expect(fullLoad.efficiency).toBeCloseTo(0.985, 2)

    // Part load (20% load) has lower efficiency
    const partLoad = calculateInverterAcPower({ pDc: 250, pAc0, etaNom: 0.985 })
    expect(partLoad.efficiency).toBeGreaterThan(0.94)
    expect(partLoad.efficiency).toBeLessThan(fullLoad.efficiency)

    // Below tare threshold (0.5% load) output is 0
    const standby = calculateInverterAcPower({ pDc: 2.0, pAc0 })
    expect(standby.pAcExpected).toBe(0)
  })
})

describe('Physics Engine: Expected Power Pipeline', () => {
  it('computes expected generation for an inverter across weather inputs', () => {
    const inverter = { id: 'INV-01', pAcRated: 1250, pDcRated: 1550 }
    const weather = { poa: 950, tAmb: 32, wind: 2.5 }

    const out = expectedForInverter(inverter, weather)
    expect(out.pExp).toBeGreaterThan(1000)
    expect(out.pExp).toBeLessThanOrEqual(1250)
    expect(out.tCell).toBeGreaterThan(32)
    expect(out.poaUsed).toBe(950)
  })

  it('supports alternate irradiance stream for sensor drift cross-checking', () => {
    const inverter = { id: 'INV-01', pAcRated: 1250, pDcRated: 1550 }
    // Field sensor reads 750 W/m² (drifted), while clear-sky reference is 900 W/m²
    const weather = { poa: 750, poaClear: 900, tAmb: 30, wind: 2.0 }

    const outField = expectedForInverter(inverter, weather, { irradianceKey: 'poa' })
    const outClear = expectedForInverter(inverter, weather, { irradianceKey: 'poaClear' })

    expect(outClear.pDcExp).toBeGreaterThan(outField.pDcExp)
    expect(outClear.poaUsed).toBe(900)
    expect(outField.poaUsed).toBe(750)
  })

  it('aggregates plant-wide expected power and summaries', () => {
    const plant = {
      acCapacityKw: 10000,
      dcCapacityKwp: 12400,
      inverters: Array.from({ length: 8 }, (_, i) => ({
        id: `INV-${String(i + 1).padStart(2, '0')}`,
        pAcRated: 1250,
        pDcRated: 1550,
      })),
    }

    const weatherRows = [
      { timestamp: '2024-03-15T00:00:00+05:30', poa: 0, tAmb: 22, wind: 2.0 },
      { timestamp: '2024-03-15T12:00:00+05:30', poa: 980, tAmb: 36, wind: 3.5 },
      { timestamp: '2024-03-15T13:00:00+05:30', poa: 1020, tAmb: 38, wind: 3.0 },
    ]

    const result = expectedForPlant(plant, weatherRows, { stepMinutes: 60 })

    expect(result.records.length).toBe(3)
    // Night record
    expect(result.records[0].pExp).toBe(0)
    // Peak noon record
    expect(result.records[1].pExp).toBeGreaterThan(8000)
    expect(result.records[1].pExp).toBeLessThanOrEqual(10000) // 8 * 1250 = 10000 kWac
    expect(result.summary.expectedEnergyKwh).toBeGreaterThan(0)
  })
})
