import { useState, useEffect } from 'react'
import { generateDayTelemetry } from '../engine/syntheticData.js'

/**
 * Returns synthetic telemetry for a given date and optional fault mode.
 * Data is memoized per (date, faultMode) pair.
 *
 * @param {string} dateStr
 * @param {string|null} faultMode
 */
export function useTelemetry(dateStr, faultMode = null) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    // Simulate async worker call with a microtask
    Promise.resolve(generateDayTelemetry(dateStr, { faultMode })).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [dateStr, faultMode])

  return { data, loading }
}

