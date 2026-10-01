/**
 * Plant model and asset hierarchy factory.
 * Pure JavaScript, no external dependencies.
 */

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
 * @param {string} id - e.g. "INV-01"
 * @param {object} [moduleSpec]
 * @returns {object} Inverter asset model
 */
export function createInverter(id, moduleSpec = STANDARD_MODULE) {
  const pAcRated = 1250 // kWac
  const dcAcRatio = 1.24
  const pDcRated = pAcRated * dcAcRatio // 1550 kWp

  // 2 MPPTs, each with 2 SCBs, each with 12 strings of 28 modules
  const mppts = [1, 2].map((mpptNum) => {
    const mpptId = `MPPT-${mpptNum}`
    const scbStart = (mpptNum - 1) * 2 + 1
    const combinerBoxes = [scbStart, scbStart + 1].map((scbNum) => {
      const scbId = `SCB-${String(scbNum).padStart(2, '0')}`
      const strings = Array.from({ length: 12 }, (_, sIdx) => {
        const stringId = `S${String(sIdx + 1).padStart(2, '0')}`
        return {
          id: stringId,
          fullId: `${id}/${scbId}/${stringId}`,
          modulesCount: 28,
          module: { ...moduleSpec },
          stringVmp: 28 * moduleSpec.vmp,   // ~1170.4 V
          stringVoc: 28 * moduleSpec.voc,   // ~1388.8 V
          stringPnom: (28 * moduleSpec.pNom) / 1000, // kWp (~15.26 kWp)
        }
      })

      return {
        id: scbId,
        fullId: `${id}/${scbId}`,
        strings,
        stringsCount: 12,
      }
    })

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
    // Flattened quick-access maps
    combinerBoxes: mppts.flatMap((m) => m.combinerBoxes),
  }
}

/**
 * Creates a solar PV plant asset model.
 * Default plant is Bhadla Block C (Rajasthan, India).
 * @param {object} [config]
 * @returns {object} Plant asset hierarchy
 */
export function createPlant(config = {}) {
  const {
    id = 'bhadla-block-c',
    name = 'Bhadla Block C',
    location = {
      lat: 27.5,
      lon: 71.9,
      elevation: 215,
      region: 'Rajasthan',
      country: 'India',
    },
    timezone = 'Asia/Kolkata',
    tilt = 25,
    azimuth = 180, // 180 = True South in northern hemisphere
    inverterCount = 8,
    moduleSpec = STANDARD_MODULE,
    tariffInrPerKwh = 2.48,
  } = config

  const inverters = Array.from({ length: inverterCount }, (_, i) => {
    const invId = `INV-${String(i + 1).padStart(2, '0')}`
    return createInverter(invId, moduleSpec)
  })

  const pAcRatedTotal = inverters.reduce((sum, inv) => sum + inv.pAcRated, 0)
  const pDcRatedTotal = inverters.reduce((sum, inv) => sum + inv.pDcRated, 0)

  return {
    id,
    name,
    location,
    timezone,
    tilt,
    azimuth,
    inverters,
    inverterCount,
    moduleSpec,
    tariffInrPerKwh,
    acCapacityKw: pAcRatedTotal,       // 10,000 kWac (10 MWac)
    dcCapacityKwp: pDcRatedTotal,     // 12,400 kWp (12.4 MWp DC)
    dcAcRatio: pDcRatedTotal / pAcRatedTotal,
    stringsPerInverter: 48,
    totalStrings: inverterCount * 48,
  }
}

/**
 * Returns portfolio of 4 diverse commercial and utility solar assets.
 * @returns {object[]} Array of 4 plants
 */
export function createPortfolio() {
  return [
    createPlant({
      id: 'bhadla-block-c',
      name: 'Bhadla Block C',
      location: {
        lat: 27.5,
        lon: 71.9,
        elevation: 215,
        region: 'Rajasthan',
        country: 'India',
      },
      timezone: 'Asia/Kolkata',
      tilt: 25,
      azimuth: 180,
      inverterCount: 8,
      tariffInrPerKwh: 2.48,
    }),
    createPlant({
      id: 'pavagada-p4',
      name: 'Pavagada P4',
      location: {
        lat: 14.1,
        lon: 77.25,
        elevation: 620,
        region: 'Karnataka',
        country: 'India',
      },
      timezone: 'Asia/Kolkata',
      tilt: 15,
      azimuth: 180,
      inverterCount: 16, // 20 MWac / 24.8 MWp
      tariffInrPerKwh: 2.85,
    }),
    createPlant({
      id: 'charanka-rooftop-cluster',
      name: 'Charanka Rooftop Cluster',
      location: {
        lat: 23.9,
        lon: 71.2,
        elevation: 40,
        region: 'Gujarat',
        country: 'India',
      },
      timezone: 'Asia/Kolkata',
      tilt: 12,
      azimuth: 180,
      inverterCount: 2, // 2.5 MWac / 3.1 MWp (C&I cluster)
      tariffInrPerKwh: 3.42,
    }),
    createPlant({
      id: 'kurnool-east',
      name: 'Kurnool East',
      location: {
        lat: 15.68,
        lon: 78.28,
        elevation: 340,
        region: 'Andhra Pradesh',
        country: 'India',
      },
      timezone: 'Asia/Kolkata',
      tilt: 15,
      azimuth: 180,
      inverterCount: 12, // 15 MWac / 18.6 MWp
      tariffInrPerKwh: 2.93,
    }),
  ]
}
