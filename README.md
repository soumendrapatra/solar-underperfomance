# Kiran RCA — Solar PV Underperformance Diagnosis & Root-Cause Engine

A web prototype of a solar PV underperformance diagnosis and root-cause engine designed for O&M engineering teams. It compares SCADA telemetry against a physics digital twin baseline, isolates root causes across fleet assets, quantifies financial revenue loss, and produces plain-language prescriptive CMMS work orders.

Developed for **Bhadla Block C** (12.4 MWp DC / 10 MWac, Rajasthan) and scalable across utility fleets.

---

## Architecture Diagram

```
+-----------------------------------------------------------------------------------+
| LAYER 01: TELEMETRY INGESTION & DIGITAL TWIN BASELINE                             |
|  - WMS Irradiance (POA) + BOM Cell Temp + Inverter SCADA (Pac, Heatsink, Strings) |
|  - NOAA Solar Position + Sandia SAPM Thermal Model (Tc = Tm + E/1000 * dT)        |
|  - PVWatts Part-Load Inverter Polynomial Efficiency + Clipping Cap                |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------+-----------------------------------------+
| LAYER 02: DIAGNOSTIC CRUCIBLE (WEB WORKER PIPELINE)                               |
|  - Pre-QC: Stuck sensor detection, dropout imputation, pyranometer drift calc    |
|  - Transient Gating: Stein et al. Variability Index (VI > 1.30 suppressed)        |
|  - Persistence Validation: >= 45m for fast trips, >= 2 days for soiling slopes    |
|  - Multi-Label Hybrid Fusion: 45% Rule Fingerprints + 55% Random Forest Prob      |
|  - Loss Waterfall: Expected -> Temp -> Soiling -> Shading -> Derating -> Strings |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------+-----------------------------------------+
| LAYER 03: PRESCRIPTIVE DECISION SUPPORT & CMMS                                    |
|  - Plain-Language Directive: Generation <X>% below expected. Causes: <Y>. Action: |
|  - Quantified Revenue Impact: Daily loss + 30-day projection (INR 3.15/kWh tariff)|
|  - CMMS Lifecycle Queue: Open -> Dispatched -> In Progress -> Resolved -> Verified|
|  - Recovery Audit: Automated re-check verifying recovered kWh/day and INR/day     |
+-----------------------------------------------------------------------------------+
```

---

## How the Engine Works in 6 Bullets

1. **Digital Twin Baseline Modeling**: Expected DC and AC generation is computed in 5-minute intervals using NOAA solar coordinates, Sandia SAPM module thermodynamics, and PVWatts inverter efficiency polynomials.
2. **Data Integrity & Drift Recalibration**: SCADA dropouts under 15 minutes are forward-filled via digital twin physics; pyranometer calibration drift is isolated by back-calculating consensus irradiance from unclipped peer inverters.
3. **Stein Cloud Transient Rejection**: Natural cloud dynamics are quantified via the Stein et al. Variability Index ($VI = \sum |\Delta POA| / \sum |\Delta POA_{CS}|$). Intervals with $VI > 1.30$ are gated from fault detection, driving transient false alarms to $0.0\%$.
4. **Deterministic Rule Fingerprinting**: Isolated failure signatures are evaluated against physical criteria (e.g., heatsink $> 78.5^\circ\text{C}$ with flat power plateau, or SCB string current $Z\text{-score} > 4.0$ with $0.0\text{ A}$ open circuit).
5. **Hybrid Multi-Label Fusion**: Rule scores ($45\%$) and Random Forest classifier probabilities ($55\%$) are fused with penalties for non-stationary data. Operational constraints (grid curtailment, inverter clipping) are routed away from equipment ticketing.
6. **Prescriptive Action Planning**: Directives synthesize the exact root cause, technician checklists, required tools (CAT IV multimeter, IR camera), LOTO high-voltage safety notes, and financial revenue at risk.

---

## Key Screens

- **`/` (Landing)**: Editorial hero with looping diurnal sun curve, interactive 4-step loss waterfall peeler, architecture review, and live metrics band.
- **`/app` (Portfolio)**: 7-stat fleet overview with animated count-up, plant comparison table with PR sparklines, and prioritized anomaly triage.
- **`/app/plant/:plantId` (Plant Deep-Dive)**: Fig. 01 PowerCurve with transient hatch bands, Fig. 02 Inverter Heatmap with 48-string expansion, and Fig. 03 Loss Waterfall with exact closure.
- **`/app/diagnosis/:diagId` (Judge Key Screen)**: Two-column layout featuring a 28px Fraunces typewriter directive, 6 mode-specific signal charts (derating, soiling, shading, string fault, curtailment, drift), signed ML feature contribution bars, ruled-out mode justifications, sticky asset impact card, and printable field report.
- **`/app/work-orders` (CMMS Queue)**: 5-stage Kanban board with 1-degree drag tilt, technician assignment (`R. Meena`, `S. Choudhary`, `A. Rao`), field notes audit trail, and recovery verification count-up (`"Recovered 412 kWh/day · INR 1,298/day"`).
- **`/app/lab` (Live Sandbox)**: Interactive controls with spring toggles, 6-block Web Worker pipeline strip, ground truth vs detected comparison, and the **"Throw Clouds at It"** transient stress test.
- **`/app/data-health` (SCADA QC)**: Pyranometer drift calibration comparison curve, 7-day completeness calendar (days by channel), human-sentence issues feed, and sanity bypass toggle showing false alarm propagation.
- **`/app/model` (Model Report)**: Validation metrics from `metrics.json` across accuracy, false-alarm rejection, quantification scatter ($y=x$), sensor-drift robustness, and Web Worker scalability benchmark ($> 2,200\text{ inv-days/sec}$).

---

## Retraining & Model Calibration Steps

1. **Feature Extraction**: Run `src/engine/diagnostics/yieldGap.js` and `transientFilter.js` on historical 5-minute SCADA intervals to generate normalized feature vectors (PR slope, heatsink persistence, SCB current variance).
2. **Ground-Truth Labeling**: Tag intervals using O&M log records and fault injection presets in `src/engine/simulator/scenarios.js`.
3. **Random Forest Training**: Fit an ensemble of 100 decision trees (max depth 8) with balanced class weights to produce probability estimates.
4. **Validation Export**: Update `src/data/metrics.json` with the updated confusion matrix, precision/recall per class, and drift sensitivity curves.

---

## Deployment Steps

The application is completely static and client-side (Web Worker engine):

### Vercel
```bash
vercel deploy
```
*`vercel.json` is configured for single-page app rewrites.*

### Netlify
```bash
netlify deploy --prod --dir=dist
```
*`netlify.toml` handles the `/* -> /index.html` 200 redirect.*

---

## Honest Limitations

1. **Sub-combiner Resolution**: Without string-level current transducers (e.g. SCBs with only busbar current measurement), single module-level bypass diode faults must be inferred from array voltage steps rather than direct current drops.
2. **Complex Bifacial Modeling**: Ground albedo variations from localized vegetation growth are approximated as uniform background soiling unless multi-sensor albedometers are present.
3. **Severe curtailment masking**: If grid operators curtail the plant below $50\%$ capacity during peak noon, inverter heatsink thermal derating cannot be observed until output is released.
