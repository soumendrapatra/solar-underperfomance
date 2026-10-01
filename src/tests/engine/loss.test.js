import { describe, it, expect } from 'vitest'
import { quantifyLoss, fmt } from '../../engine/loss.js'

describe('quantifyLoss', () => {
  it('converts Wh to kWh correctly', () => {
    const { lostEnergyKwh } = quantifyLoss(5000, 2.48)
    expect(lostEnergyKwh).toBeCloseTo(5, 3)
  })

  it('computes revenue loss correctly', () => {
    const { revenueLossInr } = quantifyLoss(10_000_000, 2.48) // 10 MWh
    expect(revenueLossInr).toBeCloseTo(24_800, 0)
  })

  it('returns 0 revenue for 0 energy', () => {
    const { revenueLossInr } = quantifyLoss(0, 2.48)
    expect(revenueLossInr).toBe(0)
  })
})

describe('fmt', () => {
  it('formats kW values', () => {
    const s = fmt(412.6, 'kW')
    expect(s).toContain('412')
    expect(s).toContain('kW')
  })

  it('formats INR values with prefix', () => {
    const s = fmt(14820, 'INR')
    expect(s).toMatch(/^INR/)
  })
})

