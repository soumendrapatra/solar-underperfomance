/** Placeholder constants for Bhadla Block C plant metadata. */
export const PLANT = {
  id: 'bhadla-block-c',
  name: 'Bhadla Block C',
  location: 'Rajasthan, India',
  dcCapacityWp: 12_400_000,   // 12.4 MWp DC
  acCapacityW:  10_000_000,   // 10 MWac
  inverters: Array.from({ length: 8 }, (_, i) => `INV-${String(i + 1).padStart(2, '0')}`),
  tariffInrPerKwh: 2.48,      // PPA tariff
  lat: 27.52,
  lon: 71.91,
}

