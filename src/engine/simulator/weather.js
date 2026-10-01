/**
 * Weather generation engine for solar PV simulation.
 * Includes clear-sky solar geometry, Markov-chain cloud dynamics,
 * ambient temperature diurnal cycling, and NOCT module temperature.
 * Pure JavaScript, no external dependencies.
 */

import { mulberry32, gaussian, between } from './rng.js'

/**
 * Calculates solar position for a given lat/lon and UTC timestamp.
 * Standard solar position equations (Spencer / Michalsky approximation).
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {Date} date - UTC Date object
 * @returns {{ elevation: number, azimuth: number, zenith: number }} Angles in degrees
 */
export function calculateSolarPosition(lat, lon, date) {
  // Days since Jan 1, 2000 12:00 UTC (J2000 epoch)
  const d = (date.getTime() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000

  // Mean solar anomaly and ecliptic coordinates
  const M = (357.5291 + 0.98560028 * d) * (Math.PI / 180)
  const C = (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M)) * (Math.PI / 180)
  const lambda = (280.4665 + 0.98564736 * d) * (Math.PI / 180) + C

  // Obliquity of the ecliptic
  const epsilon = 23.439 * (Math.PI / 180)

  // Right ascension and declination
  const sinAlpha = Math.sin(epsilon) * Math.sin(lambda)
  const delta = Math.asin(sinAlpha)

  // Greenwich Mean Sidereal Time in hours
  const gmstHours = (18.697374558 + 24.06570982441908 * d) % 24
  const gmst = (gmstHours < 0 ? gmstHours + 24 : gmstHours) * 15 * (Math.PI / 180)

  // Local sidereal time
  const theta = gmst + lon * (Math.PI / 180)
  const alpha = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda))
  const H = theta - alpha // Hour angle

  const phi = lat * (Math.PI / 180)

  // Solar elevation
  const sinElevation = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(H)
  const elevationRad = Math.asin(Math.max(-1, Math.min(1, sinElevation)))
  const elevation = elevationRad * (180 / Math.PI)

  // Solar azimuth (0 = North, 90 = East, 180 = South, 270 = West)
  const cosAz = (Math.sin(delta) - Math.sin(phi) * Math.sin(elevationRad)) /
    (Math.cos(phi) * Math.cos(elevationRad) + 1e-12)
  const azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)))
  const azimuth = Math.sin(H) > 0 ? 360 - azRad * (180 / Math.PI) : azRad * (180 / Math.PI)

  return {
    elevation: Math.max(0, elevation),
    rawElevation: elevation,
    azimuth,
    zenith: Math.max(0, 90 - elevation),
  }
}

/**
 * Calculates clear-sky GHI and POA irradiance.
 * @param {number} elevation - Solar elevation in degrees
 * @param {number} azimuth - Solar azimuth in degrees
 * @param {number} tilt - Surface tilt in degrees
 * @param {number} surfaceAzimuth - Surface azimuth in degrees (180 = South)
 * @param {number} doy - Day of year (1-365)
 * @returns {{ ghi: number, poa: number }} Irradiance in W/m²
 */
export function calculateClearSkyIrradiance(elevation, azimuth, tilt, surfaceAzimuth, doy) {
  if (elevation <= 0.8) {
    return { ghi: 0, poa: 0 }
  }

  const elevRad = elevation * (Math.PI / 180)
  const tiltRad = tilt * (Math.PI / 180)
  const gammaS = azimuth * (Math.PI / 180)
  const gammaP = surfaceAzimuth * (Math.PI / 180)

  // Extraterrestrial normal irradiance
  const I0 = 1361 * (1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365))

  // Air mass (Kasten-Young formulation)
  const am = 1 / (Math.sin(elevRad) + 0.50572 * Math.pow(elevation + 6.07995, -1.6364))

  // Clear-sky atmospheric beam transmittance
  const tauB = Math.pow(0.7, Math.pow(am, 0.678))
  const ghiClear = Math.max(0, I0 * Math.sin(elevRad) * tauB)

  // Diffuse fraction
  const dhiRatio = 0.16 + 0.08 * (1 - tauB)
  const dhiClear = ghiClear * dhiRatio
  const dniClear = Math.max(0, (ghiClear - dhiClear) / Math.sin(elevRad))

  // Angle of incidence on tilted plane
  const cosIncidence =
    Math.cos(elevRad) * Math.sin(tiltRad) * Math.cos(gammaS - gammaP) +
    Math.sin(elevRad) * Math.cos(tiltRad)

  const directPoa = dniClear * Math.max(0, cosIncidence)
  const diffusePoa = dhiClear * ((1 + Math.cos(tiltRad)) / 2)
  const albedoPoa = ghiClear * 0.2 * ((1 - Math.cos(tiltRad)) / 2)

  const poaClear = Math.max(0, directPoa + diffusePoa + albedoPoa)

  return {
    ghi: Math.round(ghiClear * 10) / 10,
    poa: Math.round(poaClear * 10) / 10,
  }
}

/**
 * Cloud model transition states.
 * @enum {string}
 */
export const CLOUD_STATES = {
  CLEAR: 'clear',
  SCATTERED: 'scattered',
  OVERCAST: 'overcast',
}

/**
 * Generates synthetic weather time-series for a plant over multiple days.
 * @param {object} plant - Plant model from plantFactory
 * @param {string|Date} startDate - Start date (e.g. '2024-03-15')
 * @param {number} [days=7] - Number of days to simulate
 * @param {number} [stepMinutes=5] - Time step in minutes (default 5 min)
 * @param {number} [seed=42] - Deterministic PRNG seed
 * @returns {Array<object>} Weather series rows
 */
export function generateWeather(plant, startDate, days = 7, stepMinutes = 5, seed = 42) {
  const rand = mulberry32(seed)
  const start = typeof startDate === 'string' ? new Date(`${startDate}T00:00:00+05:30`) : new Date(startDate)
  const totalSteps = Math.floor((days * 24 * 60) / stepMinutes)

  const lat = plant.location?.lat ?? 27.5
  const lon = plant.location?.lon ?? 71.9
  const tilt = plant.tilt ?? 25
  const azimuth = plant.azimuth ?? 180
  const noct = plant.moduleSpec?.noct ?? 45

  let cloudState = CLOUD_STATES.CLEAR
  let transientRemainingSteps = 0
  let transientFactor = 1.0

  const rows = []

  for (let i = 0; i < totalSteps; i++) {
    const timeMs = start.getTime() + i * stepMinutes * 60 * 1000
    const currentDate = new Date(timeMs)

    // IST time calculation (UTC + 5:30)
    const istTimeMs = timeMs + 5.5 * 3600 * 1000
    const istDate = new Date(istTimeMs)
    const hoursIST = istDate.getUTCHours() + istDate.getUTCMinutes() / 60

    // Day of year
    const startOfYear = Date.UTC(istDate.getUTCFullYear(), 0, 1)
    const doy = Math.floor((timeMs - startOfYear) / 86400000) + 1

    // 1. Solar position
    const { elevation, azimuth: solarAzimuth, rawElevation } = calculateSolarPosition(lat, lon, currentDate)

    // 2. Clear-sky irradiance
    const { ghi: ghiClear, poa: poaClear } = calculateClearSkyIrradiance(
      rawElevation > 0 ? elevation : 0,
      solarAzimuth,
      tilt,
      azimuth,
      doy
    )

    // 3. Cloud Markov Chain step
    const roll = rand()
    if (cloudState === CLOUD_STATES.CLEAR) {
      if (roll < 0.025) cloudState = CLOUD_STATES.SCATTERED
      else if (roll < 0.03) cloudState = CLOUD_STATES.OVERCAST
    } else if (cloudState === CLOUD_STATES.SCATTERED) {
      if (roll < 0.08) cloudState = CLOUD_STATES.CLEAR
      else if (roll < 0.12) cloudState = CLOUD_STATES.OVERCAST
    } else if (cloudState === CLOUD_STATES.OVERCAST) {
      if (roll < 0.05) cloudState = CLOUD_STATES.SCATTERED
      else if (roll < 0.07) cloudState = CLOUD_STATES.CLEAR
    }

    // Cloud transients logic
    let cloudMultiplier = 1.0
    if (cloudState === CLOUD_STATES.CLEAR) {
      cloudMultiplier = 1.0 + between(-0.015, 0.015, rand)
    } else if (cloudState === CLOUD_STATES.SCATTERED) {
      if (transientRemainingSteps > 0) {
        transientRemainingSteps--
        cloudMultiplier = transientFactor
      } else {
        // Chance of triggering a new transient dip lasting 2 to 15 min (1 to 3 steps)
        if (rand() < 0.28) {
          transientRemainingSteps = Math.floor(between(1, 3.99, rand)) // 1 to 3 five-min steps
          transientFactor = between(0.25, 0.55, rand) // sharp dip
          cloudMultiplier = transientFactor
        } else {
          // In between dips, slight cloud edge enhancement or slight reduction
          cloudMultiplier = between(0.88, 1.04, rand)
        }
      }
    } else if (cloudState === CLOUD_STATES.OVERCAST) {
      // Overcast scales irradiance down 50% to 80% (multiplier 0.20 to 0.50)
      cloudMultiplier = between(0.20, 0.50, rand)
    }

    // Apply cloud multiplier — strictly 0 when sun is down
    const isDaytime = rawElevation > 0.5
    const ghi = isDaytime ? Math.max(0, Math.round(ghiClear * cloudMultiplier * 10) / 10) : 0
    const poa = isDaytime ? Math.max(0, Math.round(poaClear * cloudMultiplier * 10) / 10) : 0

    // 4. Ambient Temperature (Sine cycle: min 24 C near dawn ~06:00, max 41 C around 15:00)
    // At hoursIST = 6.0: sin(2pi/24 * -4.5) ~ -0.924 -> T ~ 24.6 C
    // At hoursIST = 15.0: sin(2pi/24 * 4.5) ~ +0.924 -> T ~ 40.4 C
    const dailySine = Math.sin(((hoursIST - 10.5) * 2 * Math.PI) / 24)
    const tBase = 32.5 + 8.5 * dailySine
    const tNoise = gaussian(0, 0.35, rand)
    const cloudCooling = cloudState === CLOUD_STATES.OVERCAST ? -2.5 : 0
    const tAmb = Math.round((tBase + tNoise + cloudCooling) * 10) / 10

    // 5. Wind Speed (1 to 6 m/s with diurnal gusts)
    const windDiurnal = 1.0 * Math.max(0, Math.sin(((hoursIST - 8) * Math.PI) / 12))
    const windNoise = between(1.0, 5.0, rand)
    const windGust = rand() < 0.05 ? between(1.5, 3.5, rand) : 0
    const wind = Math.round(Math.min(9.5, Math.max(1.0, windNoise + windDiurnal + windGust)) * 10) / 10

    // 6. Module Temperature (NOCT model with wind cooling)
    // tModule = tAmb + (poa / 800) * (noct - 20) * (1 - 0.04 * wind)
    let tModule = tAmb
    if (poa > 0) {
      const deltaT = (poa / 800) * (noct - 20) * Math.max(0.5, 1 - 0.04 * wind)
      tModule = Math.round((tAmb + deltaT) * 10) / 10
    }

    // Form ISO timestamp string with +05:30 offset
    const isoTimestamp = istDate.toISOString().replace('Z', '+05:30')

    rows.push({
      timestamp: isoTimestamp,
      stepIndex: i,
      ghi,
      poa,
      tAmb,
      tModule,
      wind,
      cloudState,
      solarElevation: Math.round(elevation * 100) / 100,
      solarAzimuth: Math.round(solarAzimuth * 100) / 100,
    })
  }

  return rows
}
