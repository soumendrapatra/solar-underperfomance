import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../../engine/prng.js'

describe('mulberry32', () => {
  it('produces values in [0, 1)', () => {
    const rand = mulberry32(42)
    for (let i = 0; i < 1000; i++) {
      const v = rand()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is deterministic — same seed gives same sequence', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b())
    }
  })

  it('different seeds give different sequences', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    // At least one value should differ
    const diffs = Array.from({ length: 10 }, () => a() !== b())
    expect(diffs.some(Boolean)).toBe(true)
  })
})

