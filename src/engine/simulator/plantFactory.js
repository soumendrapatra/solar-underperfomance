/**
 * Plant model and asset hierarchy factory for GCE Kalahandi campus rooftop zones.
 * Pure JavaScript, no external dependencies.
 */

import { CAMPUS_SOLAR_ZONES, COLLEGE, DEFAULT_SETTINGS } from '../../config/campus.js'

export const STANDARD_MODULE = {
  pNom: 545,          // Nameplate rating in Wp
  voc: 49.6,          // Open-circuit voltage in V
  vmp: 41.8,          // Voltage at MPP in V
  imp: 13.04,         // Current at MPP in A
  gamma: -0.0035,     // Temperature coefficient of power (-0.35 %/°C)
  gammaVoc: -0.0028,  // Temp coefficient of Voc (-0.28 %/°C)
  alphaIsc: 0.0005,   // Temp coefficient of Isc (+0.05 %/°C)
  noct: 45,           // Nominal Operating Cell Temperature in °C
}

/**
 * Creates an Inverter asset definition with MPPTs, Combiner Boxes (SCBs), and Strings.
 * @param {string} id - e.g. "INV-A1"
 * @param {number} pAcRated - kWac rating
 * @param {number} pDcRated - kWp DC rating
 * @param {object} [moduleSpec]
 * @returns {object} Inverter asset model
 */
export function createInverter(id, pAcRated = 25, pDcRated = 27.5, moduleSpec = STANDARD_MODULE) {
  const dcAcRatio = pAcRated > 0 ? pDcRated / pAcRated : 1.11

  // 2 MPPTs, each with 1 or 2 combiner channels
  const mppts = [1, 2].map((mpptNum) => {
    const mpptId = `MPPT-${mpptNum}`
    const scbId = `SCB-${id.replace('INV-', '')}${mpptNum}`
    const strings = Array.from({ length: 4 }, (_, sIdx) => {
      const stringId = `STR-${String(sIdx + 1).padStart(2, '0')}`
      return {
        id: stringId,
        fullId: `${id}/${scbId}/${stringId}`,
        modulesCount: 20,
        module: { ...moduleSpec },
        stringVmp: 20 * moduleSpec.vmp,
        stringVoc: 20 * moduleSpec.voc,
        stringPnom: (20 * moduleSpec.pNom) / 1000,
      }
    })

    const combinerBoxes = [
      {
        id: scbId,
        fullId: `${id}/${scbId}`,
        strings,
        stringsCount: strings.length,
      },
    ]

    return {
      id: mpptId,
      fullId: `${id}/${mpptId}`,
      combinerBoxes,
    }
  })

  return {
    id,
    pAcRated,
    pDcRated,
    dcAcRatio,
    mppts,
    combinerBoxes: mppts.flatMap((m) => m.combinerBoxes),
  }
}

/**
 * Creates a campus solar rooftop zone asset model.
 * Default zone is Main Academic Block (GCE Kalahandi).
 * @param {object} [config]
 * @returns {object} Zone asset hierarchy
 */
export function createPlant(config = {}) {
  const defaultZone = CAMPUS_SOLAR_ZONES[0]
  const {
    id = defaultZone.id,
    zoneId = defaultZone.zoneId,
    name = defaultZone.name,
    description = defaultZone.description,
    location = {
      lat: COLLEGE.coordinates.lat,
      lon: COLLEGE.coordinates.lon,
      elevation: 250,
      region: COLLEGE.location,
      country: 'India',
      note: COLLEGE.coordinates.note,
    },
    timezone = 'Asia/Kolkata',
    tilt = 20,
    azimuth = 180, // True South
    capacityDcKw = defaultZone.capacityDcKw,
    capacityAcKw = defaultZone.capacityAcKw,
    inverterIds = defaultZone.inverters,
    moduleSpec = STANDARD_MODULE,
    tariffInrPerKwh = DEFAULT_SETTINGS.tariffInrPerKwh,
    defaultIssue = defaultZone.defaultIssue,
  } = config

  const invCount = inverterIds.length || 1
  const perInvAc = capacityAcKw / invCount
  const perInvDc = capacityDcKw / invCount

  const inverters = inverterIds.map((invId) =>
    createInverter(invId, perInvAc, perInvDc, moduleSpec)
  )

  return {
    id,
    zoneId,
    name,
    description,
    location,
    timezone,
    tilt,
    tiltDeg: tilt,
    azimuth,
    azimuthDeg: azimuth,
    inverters,
    inverterCount: inverters.length,
    moduleSpec,
    tariffInrPerKwh,
    acCapacityKw: capacityAcKw,
    dcCapacityKwp: capacityDcKw,
    dcAcRatio: capacityDcKw / capacityAcKw,
    stringsPerInverter: 8,
    totalStrings: inverters.length * 8,
    defaultIssue,
    campus: COLLEGE.name,
  }
}

/**
 * Returns portfolio of all 5 GCE Kalahandi campus rooftop solar zones.
 * @returns {object[]} Array of 5 campus solar zones
 */
export function createPortfolio() {
  return CAMPUS_SOLAR_ZONES.map((zone) =>
    createPlant({
      id: zone.id,
      zoneId: zone.zoneId,
      name: zone.name,
      description: zone.description,
      capacityDcKw: zone.capacityDcKw,
      capacityAcKw: zone.capacityAcKw,
      inverterIds: zone.inverters,
      defaultIssue: zone.defaultIssue,
    })
  )
}
