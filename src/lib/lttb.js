/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm.
 * Downsamples time-series data to `threshold` points while preserving visual extrema and area.
 *
 * @param {Array<{ x: number, y: number } | [number, number]>} data - Input series
 * @param {number} [threshold=1500] - Target point count
 * @returns {Array<any>} Downsampled series
 */
export function lttb(data, threshold = 1500) {
  if (!data || data.length <= threshold || threshold < 3) {
    return data || []
  }

  const sampled = []
  const dataLength = data.length
  const every = (dataLength - 2) / (threshold - 2)

  let a = 0
  let maxAreaPoint = data[0]
  let nextA = 0

  sampled.push(data[a])

  for (let i = 0; i < threshold - 2; i++) {
    let avgX = 0
    let avgY = 0
    let avgRangeStart = Math.floor((i + 1) * every) + 1
    let avgRangeEnd = Math.floor((i + 2) * every) + 1
    avgRangeEnd = avgRangeEnd < dataLength ? avgRangeEnd : dataLength

    const avgRangeLength = avgRangeEnd - avgRangeStart

    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      const pt = data[j]
      const x = Array.isArray(pt) ? pt[0] : pt.x
      const y = Array.isArray(pt) ? pt[1] : pt.y
      avgX += x
      avgY += y
    }
    avgX /= avgRangeLength || 1
    avgY /= avgRangeLength || 1

    let rangeOffs = Math.floor(i * every) + 1
    const rangeTo = Math.floor((i + 1) * every) + 1

    const ptA = data[a]
    const pointAX = Array.isArray(ptA) ? ptA[0] : ptA.x
    const pointAY = Array.isArray(ptA) ? ptA[1] : ptA.y

    let maxArea = -1

    for (let j = rangeOffs; j < rangeTo; j++) {
      const ptJ = data[j]
      const x = Array.isArray(ptJ) ? ptJ[0] : ptJ.x
      const y = Array.isArray(ptJ) ? ptJ[1] : ptJ.y

      const area =
        Math.abs(
          (pointAX - avgX) * (y - pointAY) -
            (pointAX - x) * (avgY - pointAY)
        ) * 0.5

      if (area > maxArea) {
        maxArea = area
        maxAreaPoint = ptJ
        nextA = j
      }
    }

    sampled.push(maxAreaPoint)
    a = nextA
  }

  sampled.push(data[dataLength - 1])
  return sampled
}
