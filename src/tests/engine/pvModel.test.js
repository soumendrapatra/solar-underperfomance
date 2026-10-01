import { describe, it, expect } from 'vitest'
import { expectedPower, performanceRatio } from '../../engine/pvModel.js'

describe('expectedPower', () => {
  it('returns 0 at night (poa = 0)', () => {
    const { pExpected } = expectedPower({ ghi: 0, poa: 0, tAmb: 25, ws: 2, pDc: 10000 })
    expect(pExpected).toBe(0)
  })

  it('returns positive power at STC (poa = 1000, tAmb = 25)', () => {
    const { pExpected } = expectedPower({ ghi: 1000, poa: 1000, tAmb: 25, ws: 1, pDc: 10000 })
    expect(pExpected).toBeGreaterThan(0)
    expect(pExpected).toBeLessThanOrEqual(10000) // cannot exceed nameplate
  })

  it('higher temperature reduces power (negative gamma)', () => {
    const hot  = expectedPower({ ghi: 800, poa: 800, tAmb: 45, ws: 1, pDc: 10000 })
    const cool = expectedPower({ ghi: 800, poa: 800, tAmb: 20, ws: 1, pDc: 10000 })
    expect(hot.pExpected).toBeLessThan(cool.pExpected)
  })

  it('cell temperature is above ambient in sunshine', () => {
    const { tCell } = expectedPower({ ghi: 800, poa: 800, tAmb: 30, ws: 1, pDc: 10000 })
    expect(tCell).toBeGreaterThan(30)
  })
})

describe('performanceRatio', () => {
  it('returns NaN for near-zero POA', () => {
    expect(performanceRatio(1000, 5, 10000)).toBeNaN()
  })

  it('returns ~0.82 for nominal operation', () => {
    // At STC, if pActual = pDc * 0.82, PR should be ~0.82
    const pDc = 10000
    const poa = 1000
    const pActual = pDc * 0.82
    const pr = performanceRatio(pActual, poa, pDc)
    expect(pr).toBeCloseTo(0.82, 2)
  })
})

