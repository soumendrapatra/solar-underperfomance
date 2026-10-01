/**
 * Deterministic Random Number Generator (PRNG) using mulberry32.
 * Includes helpers for Gaussian distributions, uniform ranges, and array picking.
 * Pure JavaScript, no external dependencies.
 */

/**
 * 32-bit state PRNG (Mulberry32).
 * @param {number} seed - 32-bit integer seed
 * @returns {() => number} Function returning floats in [0, 1)
 */
export function mulberry32(seed) {
  let s = (seed >>> 0) || 1
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Box-Muller transform for standard or specified normal distribution.
 * @param {number} [mean=0]
 * @param {number} [std=1]
 * @param {() => number} [rand=Math.random]
 * @returns {number}
 */
export function gaussian(mean = 0, std = 1, rand = Math.random) {
  let u1 = rand()
  let u2 = rand()
  // Guard against log(0)
  while (u1 <= 1e-15) {
    u1 = rand()
  }
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  return mean + z0 * std
}

/**
 * Uniform random float between min (inclusive) and max (exclusive).
 * @param {number} min
 * @param {number} max
 * @param {() => number} [rand=Math.random]
 * @returns {number}
 */
export function between(min, max, rand = Math.random) {
  return min + (max - min) * rand()
}

/**
 * Pick a random element from an array.
 * @template T
 * @param {T[]} array
 * @param {() => number} [rand=Math.random]
 * @returns {T}
 */
export function pick(array, rand = Math.random) {
  if (!array || array.length === 0) return undefined
  const idx = Math.floor(rand() * array.length)
  return array[idx]
}

/**
 * Create a stateful RNG instance bound to a seed.
 * @param {number} seed
 */
export function createRng(seed = 42) {
  const next = mulberry32(seed)
  return {
    next,
    random: next,
    gaussian: (mean = 0, std = 1) => gaussian(mean, std, next),
    between: (min, max) => between(min, max, next),
    pick: (array) => pick(array, next),
  }
}
