import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from './useReducedMotion.js'

/**
 * Animates a number from 0 (or a previous value) to `target` over `duration` ms.
 * Uses requestAnimationFrame with ease-out. Skips animation if reduced motion is on.
 *
 * @param {number} target     - Final value
 * @param {number} [duration=700] - Animation duration in ms
 * @returns {number}          - Current animated value
 */
export function useCountUp(target, duration = 700) {
  const reduced = useReducedMotion()
  const [value, setValue] = useState(reduced ? target : 0)
  const rafRef = useRef(null)
  const startRef = useRef(null)
  const fromRef = useRef(0)

  useEffect(() => {
    if (reduced) {
      setValue(target)
      return
    }

    fromRef.current = value
    startRef.current = null

    function step(ts) {
      if (startRef.current === null) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(fromRef.current + (target - fromRef.current) * eased)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, reduced])

  return value
}
