/**
 * Central Campus Configuration
 * Government College of Engineering Kalahandi — SolarPower Prototype
 */

export const BRAND = {
  name: 'SolarPower',
  title: 'SolarPower: Campus Rooftop Solar Performance Monitoring and Fault Diagnosis System',
  shortTitle: 'SolarPower Campus',
}

export const COLLEGE = {
  name: 'Government College of Engineering Kalahandi',
  shortName: 'GCE Kalahandi',
  location: 'Kalahandi, Odisha',
  coordinates: {
    lat: 19.9015,
    lon: 83.1649,
    note: 'Approximate campus coordinates for prototype simulation',
  },
  departments: ['CSE', 'ECE', 'EE', 'ME', 'CE'],
  projectMode: 'Academic prototype',
  dataMode: 'Simulated telemetry',
}

export const CAMPUS_SOLAR_ZONES = [
  {
    id: 'academic-block',
    zoneId: 'ZONE-A',
    name: 'Main Academic Block',
    description: 'Four floor academic building rooftop',
    capacityDcKw: 50,
    capacityAcKw: 45,
    defaultIssue: 'Uniform dust and soiling',
    inverters: ['INV-A1', 'INV-A2'],
    combiners: ['SCB-A1', 'SCB-A2'],
  },
  {
    id: 'mechanical-workshop',
    zoneId: 'ZONE-B',
    name: 'Mechanical Workshop',
    description: 'Workshop roof with partial shade risk',
    capacityDcKw: 30,
    capacityAcKw: 27,
    defaultIssue: 'Morning partial shading',
    inverters: ['INV-W1'],
    combiners: ['SCB-W1'],
  },
  {
    id: 'library-hall',
    zoneId: 'ZONE-C',
    name: 'Library Hall',
    description: 'Library rooftop solar section',
    capacityDcKw: 20,
    capacityAcKw: 18,
    defaultIssue: 'Inverter temperature derating',
    inverters: ['INV-L1'],
    combiners: ['SCB-L1'],
  },
  {
    id: 'extra-class-building',
    zoneId: 'ZONE-D',
    name: 'Extra Class Building',
    description: 'Additional classroom rooftop section',
    capacityDcKw: 20,
    capacityAcKw: 18,
    defaultIssue: 'Normal operation',
    inverters: ['INV-C1'],
    combiners: ['SCB-C1'],
  },
  {
    id: 'department-roof-cluster',
    zoneId: 'ZONE-E',
    name: 'Department Roof Cluster',
    description: 'Combined rooftop section for CSE, ECE, EE, ME and CE',
    capacityDcKw: 30,
    capacityAcKw: 27,
    defaultIssue: 'String mismatch',
    inverters: ['INV-D1'],
    combiners: ['SCB-D1'],
  },
]

export const ASSUMPTIONS = [
  'The rooftop capacities are assumed for prototype demonstration.',
  'Telemetry is simulated using a simplified photovoltaic performance model.',
  'Faults are synthetic and used for academic evaluation.',
  'The system can be connected to real inverter and weather-station data in future work.',
]

export const DEFAULT_SETTINGS = {
  tariffInrPerKwh: 6.5,
  currency: 'INR',
  simulationWindowDays: 7,
}

export const CAMPUS_STAFF_ROLES = [
  'Campus Electrician',
  'Electrical Lab Assistant',
  'Maintenance Incharge',
]
