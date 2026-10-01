/**
 * Prescriptive Action Templates.
 * Standardized O&M procedures, checklists, tool lists, and safety notes.
 * Two deterministic text variants per mode for O&M dispatch clarity.
 * Pure JavaScript, no external dependencies.
 */

export const ACTION_TEMPLATES = {
  inverter_thermal_derating: {
    name: 'Inverter Thermal Derating',
    likelyCauses: [
      'inverter derating and high module temperature',
      'inverter heatsink fan failure and restricted cabinet ventilation',
    ],
    recommendedActions: [
      'inspect {assetId} and verify cooling conditions',
      'service {assetId} external heat-exchanger fans and clean cabinet intake filters',
    ],
    checklist: [
      'Inspect cabinet intake and exhaust louvers for dust clogs or insect nests',
      'Verify 230V auxiliary power supply and rotation of external heatsink cooling fans',
      'Measure ambient-to-heatsink delta with thermal camera; verify delta < 25 °C',
      'Check inverter event log for E014/E015 internal cabinet thermal fault codes',
    ],
    estimatedEffort: '1.5 hours',
    tools: [
      'Calibrated handheld thermal imaging camera',
      'Compressed dry air canister / soft louver brush',
      'Digital multimeter (CAT IV 1000V)',
      'Cabinet security key set',
    ],
    safetyNote:
      'Exercise caution: internal heatsink surfaces may exceed 85 °C. Follow Arc Flash Category 2 PPE procedures before opening inverter front enclosure.',
  },

  string_open_circuit: {
    name: 'String Open Circuit',
    likelyCauses: [
      'string open circuit and high module temperature',
      'blown string fuse or disconnected DC branch connector',
    ],
    recommendedActions: [
      'inspect {assetId} and replace blown fuse or repair disconnected connector',
      'test continuity across {assetId} and inspect row wiring for physical cable severance',
    ],
    checklist: [
      'Isolate combiner box DC switch and verify zero current with DC clamp meter',
      'Extract 15A 1500V gPV fuse on target string and verify continuity with ohmmeter',
      'Walk physical row to inspect MC4 connectors, cable zip ties, and animal chew damage',
      'Measure open-circuit string voltage (Voc) at terminal to confirm module string continuity',
    ],
    estimatedEffort: '1.0 hour',
    tools: [
      'Solar irradiance meter and calibrated DC clamp meter (CAT IV 1000V)',
      'MC4 disconnect tool and ratcheting crimp set',
      'Spare 15A / 1500V gPV cylindrical fuses (10x38 mm)',
      'Digital insulation resistance (megger) tester',
    ],
    safetyNote:
      'Lethal DC voltage present up to 1500V. Never disconnect MC4 connectors under load. Verify combiner box main switch is open before touching fuse holders.',
  },

  bypass_diode_failure: {
    name: 'Bypass Diode Failure / Hotspot',
    likelyCauses: [
      'bypass diode short circuit and localized module mismatch',
      'shorted junction box bypass diode resulting in permanent voltage drop',
    ],
    recommendedActions: [
      'inspect {assetId} with thermal camera and replace defective module junction box',
      'perform I-V curve tracing on {assetId} to isolate the faulted module for warranty RMA',
    ],
    checklist: [
      'Perform IR thermography scan along string during peak irradiance (> 700 W/m²)',
      'Confirm hot sub-string block showing > 12 °C thermal rise over adjacent cells',
      'Measure string operating voltage Vmp under load; verify ~14V drop per faulted diode',
      'Flag module serial number and initiate manufacturer RMA replacement ticket',
    ],
    estimatedEffort: '2.0 hours',
    tools: [
      'Calibrated radiometric infrared thermal camera',
      'Portable I-V curve tracer (1500V / 30A)',
      'Digital multimeter with needle probes',
      'Torque wrench for module mounting clamps',
    ],
    safetyNote:
      'Avoid touching hot module glass directly. Ensure string is de-energized prior to junction box servicing or module unbolting.',
  },

  soiling: {
    name: 'Uniform Soiling',
    likelyCauses: [
      'uniform dust accumulation and ambient atmospheric haze',
      'particulate deposition across module glass surfaces',
    ],
    recommendedActions: [
      'schedule automated robotic cleaning or wet-washing cycle for {assetId}',
      'dispatch field washing crew to clean block {assetId} using demineralized water',
    ],
    checklist: [
      'Measure soiling ratio with optical reflectometer or handheld reference cell',
      'Inspect module front glass for cemented dust, bird droppings, or pollen crusting',
      'Check cleaning robot docking station battery charge and water pressure pump',
      'Log pre-wash and post-wash string current baseline to verify restoration',
    ],
    estimatedEffort: '4.0 hours (block wash)',
    tools: [
      'Soft microfiber module washing brushes (TDS < 50 ppm water)',
      'Handheld reference cell / pyranometer',
      'Automated tractor / robotic crawler system',
    ],
    safetyNote:
      'Perform washing only during early morning or evening hours (POA < 200 W/m²). Never spray cold water on thermally stressed hot module glass (> 50 °C) to avoid thermal shock breakage.',
  },

  partial_shading: {
    name: 'Partial Shading',
    likelyCauses: [
      'geometric row-to-row shading and low morning sun angle',
      'vegetation overgrowth or terrain obstruction on southern horizon',
    ],
    recommendedActions: [
      'inspect {assetId} for tracker backtracking calibration or vegetation trimming',
      'verify tracker astronomical angle algorithm and calibrate tilt inclinometer on {assetId}',
    ],
    checklist: [
      'Check single-axis tracker angular position against theoretical astronomical table',
      'Inspect terrain slope and trim ground vegetation exceeding 30 cm along row front',
      'Verify tracker controller motor limits and backtracking curve parameters',
    ],
    estimatedEffort: '1.5 hours',
    tools: [
      'Digital inclinometer / bubble level gauge',
      'Brush cutter / vegetation trimmer',
      'Tracker SCADA programming console',
    ],
    safetyNote:
      'Beware of pinch points during mechanical tracker slew operations. Lock out motor drive before working near torque tubes.',
  },

  grid_curtailment: {
    name: 'Grid Curtailment',
    likelyCauses: [
      'DISCOM grid export setpoint restriction and active feeder congestion',
      'grid operator active power setpoint limiting plant export capacity',
    ],
    recommendedActions: [
      'verify PPC (Power Plant Controller) active power setpoint against SLDC dispatch order',
      'confirm DISCOM schedule with state load dispatch center and log curtailment loss',
    ],
    checklist: [
      'Check PPC SCADA communications with State Load Dispatch Centre (SLDC)',
      'Verify grid frequency and substation bus voltage levels',
      'Log generation curtailment start/end timestamps for regulatory tariff compensation',
    ],
    estimatedEffort: '0.5 hours',
    tools: ['SCADA substation monitoring console', 'PPC telemetry logger'],
    safetyNote: 'Regulatory and software setting only. No field electrical intervention required.',
  },

  pyranometer_drift: {
    name: 'Pyranometer Drift',
    likelyCauses: [
      'pyranometer optical dome soiling and sensor calibration drift',
      'WMS sensor calibration drift relative to secondary reference and fleet yield',
    ],
    recommendedActions: [
      'clean WMS pyranometer quartz dome and verify desiccant canister condition',
      'perform field secondary calibration against portable reference pyranometer',
    ],
    checklist: [
      'Clean optical glass dome with lint-free cloth and deionized alcohol solution',
      'Check silica gel desiccant color indicator inside sensor housing (blue = good, pink = saturated)',
      'Measure zero-offset signal under dark cover; verify < 2 W/m²',
      'Co-locate secondary Class A calibrated pyranometer for 24h verification',
    ],
    estimatedEffort: '1.0 hour',
    tools: [
      'Optical lint-free lens cleaning wipes',
      'Replacement silica gel desiccant cartridge',
      'Secondary Class A reference pyranometer',
      'Precision digital millivoltmeter',
    ],
    safetyNote: 'Sensor tower ladder work: use full-body safety harness with dual shock-absorbing lanyards.',
  },
}
