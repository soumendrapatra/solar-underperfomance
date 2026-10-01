import { describe, it, expect } from 'vitest'
import { fingerprint, ruleSoiling, ruleCloudTransient } from '../../engine/fingerprint.js'

const BASE_FEATURES = {
  prDrop: 0,
  stringCvIdc: 0.02,
  tInvDelta: 8,
  poaStdMin: 10,
  iClipFraction: 0,
  gridVoltDrop: 0,
  soilingIndex: 0,
  openStrings: 0,
}

describe('ruleSoiling', () => {
  it('scores 0 on clean plant with no PR drop', () => {
    expect(ruleSoiling(BASE_FEATURES)).toBe(0)
  })

  it('scores > 0 when PR drops and soiling index is elevated', () => {
    const score = ruleSoiling({ ...BASE_FEATURES, prDrop: -0.12, soilingIndex: 0.5 })
    expect(score).toBeGreaterThan(0)
  })

  it('suppresses score when string CV is high (mismatch, not soiling)', () => {
    const score = ruleSoiling({ ...BASE_FEATURES, prDrop: -0.12, stringCvIdc: 0.3 })
    expect(score).toBe(0)
  })
})

describe('ruleCloudTransient', () => {
  it('scores 0 when POA is stable', () => {
    expect(ruleCloudTransient({ ...BASE_FEATURES, poaStdMin: 5 })).toBe(0)
  })

  it('scores > 0 when POA is highly variable', () => {
    expect(ruleCloudTransient({ ...BASE_FEATURES, poaStdMin: 120 })).toBeGreaterThan(0)
  })
})

describe('fingerprint', () => {
  it('returns all expected fault keys', () => {
    const result = fingerprint(BASE_FEATURES)
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining([
        'soiling', 'stringOpenCircuit', 'stringMismatch',
        'inverterThermal', 'inverterClipping', 'gridCurtailment', 'cloudTransient',
      ])
    )
  })

  it('all scores are in [0, 1]', () => {
    const result = fingerprint(BASE_FEATURES)
    Object.values(result).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    })
  })
})

