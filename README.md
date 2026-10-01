# SolarPower: Campus Rooftop Solar Performance Monitoring and Fault Diagnosis System

An academic engineering prototype of a campus rooftop solar PV performance monitoring and fault diagnosis system developed for **Government College of Engineering Kalahandi** (Kalahandi, Odisha).

The system compares high-resolution rooftop telemetry against a physics digital twin baseline, isolates physical fault signatures across 5 campus buildings, quantifies institutional loss at local tariff rates, and produces actionable maintenance directives for the campus electrical team.

> **ACADEMIC PROTOTYPE NOTICE:** This system operates on deterministic high-resolution simulated telemetry generated via calibrated PV physics models. Live campus SCADA hardware integration is slated for future work.

---

## Campus Solar Profile (Government College of Engineering Kalahandi)

| Zone ID | Building Name | DC Capacity | Inverters | Monitored Array Focus |
|---|---|---|---|---|
| `ZONE-A` | **Main Academic Block** | 50 kWp DC | 2x String (22 kW, 23 kW) | Dust accumulation / Rooftop soiling |
| `ZONE-B` | **Mechanical Workshop** | 30 kWp DC | 1x String (27 kW) | Parapet wall morning partial shading |
| `ZONE-C` | **Library Hall** | 20 kWp DC | 1x String (18 kW) | Inverter heatsink thermal derating |
| `ZONE-D` | **Extra Class Building** | 20 kWp DC | 1x String (18 kW) | Optimal clear-sky baseline operation |
| `ZONE-E` | **Department Roof Cluster** | 30 kWp DC | 1x String (27 kW) | String open circuit & wiring mismatch |
| **Total** | **5 Rooftop Zones** | **150 kWp DC / 135 kWac** | **6 String Inverters** | **12 Monitored String Channels** |

- **Location**: Kalahandi, Odisha (approx. 19.9015° N, 83.1649° E)
- **Institutional Tariff**: INR 6.50 / kWh (concessional campus educational rate)
- **Target Maintenance Team**: Campus Electrician, Electrical Lab Assistant, Maintenance Incharge

---

## Architecture Diagram

```
+-----------------------------------------------------------------------------------+
| LAYER 01: CAMPUS ROOFTOP TELEMETRY & DIGITAL TWIN BASELINE                        |
|  - Rooftop POA Irradiance + Ambient Temp + Inverter Telemetry (Pac, Temp, Idc)    |
|  - NOAA Solar Position + Sandia SAPM Thermal Model (Tc = Tm + E/1000 * dT)        |
|  - PVWatts Part-Load Inverter Polynomial Efficiency + Clipping Threshold          |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------+-----------------------------------------+
| LAYER 02: DIAGNOSTIC CRUCIBLE (CLIENT-SIDE WEB WORKER ENGINE)                     |
|  - Pre-QC: Stuck sensor detection, dropout imputation, pyranometer drift calc    |
|  - Transient Gating: Stein et al. Variability Index (VI > 1.30 suppressed)        |
|  - Persistence Validation: >= 45m for thermal trips, >= 2 days for dust soiling   |
|  - Multi-Label Hybrid Fusion: 45% Rule Fingerprints + 55% Random Forest Prob      |
|  - Loss Waterfall: Expected -> Temp -> Soiling -> Shading -> Derating -> Strings |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------+-----------------------------------------+
| LAYER 03: PRESCRIPTIVE CAMPUS MAINTENANCE DIRECTIVES                              |
|  - Plain-Language Directive: Generation <X>% below expected. Causes: <Y>. Action: |
|  - Quantified Campus Loss: Daily loss + 30-day projection (INR 6.50/kWh tariff)   |
|  - Maintenance Queue: Open -> Assigned -> In Progress -> Resolved -> Verified     |
|  - Staff Roles: Campus Electrician, Electrical Lab Assistant, Maintenance Head    |
+-----------------------------------------------------------------------------------+
```

---

## Key Modules & Pages

- **`/` (Landing)**: Academic prototype introduction, campus rooftop capacity breakdown, interactive 4-step loss waterfall, and live metrics band.
- **`/app` (Campus Overview)**: 7-stat campus KPI bar, rooftop zone comparison table with PR sparklines, and prioritized maintenance attention queue.
- **`/app/plant/:plantId` (Building Performance)**: PowerCurve with transient bands, Inverter Heatmap with string-level telemetry, and Loss Waterfall decomposition.
- **`/app/diagnosis/:diagId` (Root-Cause Directive)**: Prescriptive recommendation for campus staff, dual-axis signal charts (derating, soiling, shading, string fault, curtailment, sensor drift), signed ML feature contributions, and printable inspection protocol.
- **`/app/work-orders` (Maintenance Actions)**: 5-column Kanban board for campus work orders, assignee lead selection (Campus Electrician, Lab Assistant, Maintenance Incharge), and safety instructions.
- **`/app/lab` (Scenario Lab)**: Interactive fault injection sandbox (soiling slope, shading window, thermal derating, string disconnection) with the **"Throw Clouds at It"** transient rejection stress test.
- **`/app/data-health` (Telemetry QC)**: Sensor drift calibration curve, 7-day data completeness calendar, and sanity bypass toggle.
- **`/app/model` (Model Evaluation)**: Hybrid physics-ML model validation metrics (93.8% Macro F1, 0.0% transient false alarms, MAPE 6.2%) evaluated against synthetic test sets.
- **`/app/methodology` (Academic Documentation)**: Complete project methodology covering objectives, PV physics formulas, Stein VI transient filter, SHAP feature attribution, assumptions, and hardware deployment roadmap.
- **`/app/settings` (Settings & Calibration)**: Institutional electricity tariffs, college campus profile, console theme toggles, and Web Worker performance benchmark.

---

## Technical Stack

- **Frontend Framework**: React 18 + Vite (SPA)
- **Styling**: Tailwind CSS with custom Paper (Light) and Console (Dark) themes
- **Typography**: Fraunces (Headings) + Inter (Interface) + JetBrains Mono (Technical telemetry)
- **Motion & Transitions**: Framer Motion
- **Diagnostic Engine**: Pure JavaScript Web Worker (runs in a separate background thread without UI blocking)
- **Deployment Target**: Vercel / Netlify (Zero backend dependencies, 100% static client-side execution)

---

## Limitations & Future Scope

1. **Hardware Integration**: Telemetry is currently synthesized via calibrated physics simulations. Physical RS485 Modbus / MQTT IoT gateway integration is planned for phase 2.
2. **Micro-Inverter Monitoring**: Prototype models string inverters with sub-array combiner channels; module-level power electronics (MLPE) are not currently represented.
3. **Severe Curtailment Masking**: Inverter thermal derating cannot be detected during active campus transformer export curtailment because power remains below threshold.
