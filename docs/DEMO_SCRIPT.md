# Kiran RCA — Live Demonstration Script (4 Minutes)

This script provides an exact 4-minute walkthrough flow for judges and evaluators, highlighting the three layers, transient rejection, explainable ML, and prescriptive CMMS ticketing.

---

## Act 1: The Hook & Landing Overview (0:00 - 0:45)
**URL**: `/`

1. **The Hero Problem**:
   - Point out the headline: *"Your plant lost 18 % today. Here is why."*
   - Observe the looping sun dot along the diurnal curve, demonstrating clear sky vs actual generation and the shaded yield gap in fault red.
2. **From Gap to Cause Waterfall**:
   - Scroll down to Section 3.
   - Click through steps **01 to 04** (*Ambient Temperature*, *Uniform Desert Soiling*, *Inverter Thermal Derating*, *String Open Circuit*).
   - Show how Kiran isolates the gap into discrete physical buckets instead of dumping a vague percentage on the operator.
3. **DiagnosisTyper**:
   - Scroll to Section 5 to watch the live typewriter directive formulate the exact O&M sentence:
     `"Generation is 18.2 % below expected. Likely causes: Inverter Thermal Derating on INV-04. Recommended action: Inspect blower fan #2 and clean intake air filters."`
4. **Transition**: Click **"Open Console"** to enter the operational dashboard at `/app`.

---

## Act 2: Fleet Portfolio & Plant Deep-Dive (0:45 - 1:30)
**URL**: `/app` &rarr; `/app/plant/bhadla-block-c`

1. **Portfolio Overview**:
   - Review the 7-stat row with live count-up on mount.
   - Note the plant table comparing **Bhadla Block C** (12.4 MWp), **Pavagada P4**, **Charanka Rooftop**, and **Kurnool East**.
   - Review the *"What needs attention"* top-prioritized anomalies banner.
2. **Plant Digital Twin Inspection (`/app/plant/bhadla-block-c`)**:
   - **Fig. 01 PowerCurve**: Hover crosshair across the day. Note the hatched bands where the **Stein Variability Index** detected cloud transients and suppressed them.
   - **Fig. 02 Inverter Heatmap**: Observe the 4 SCB cells per inverter. Click **INV-04** to expand and reveal the 48-string current bars.
   - **Fig. 03 Loss Waterfall**: Verify exact sum closure from Expected Power down to Actual Power, with the grey *"Unexplained"* bar reflecting zero residual leakage.
3. **Transition**: Click **"INSPECT &rarr;"** on the **Inverter Thermal Derating** card to jump into the dedicated judge screen at `/app/diagnosis/thermal_derating`.

---

## Act 3: Key Screen for Judges — Diagnosis & Work Orders (1:30 - 2:30)
**URL**: `/app/diagnosis/thermal_derating` &rarr; `/app/work-orders`

1. **The Left Column**:
   - Read the Fraunces 28px prescriptive directive with numbers in mono amber.
   - **Tab 1 (Signal)**: Show the mode-specific dual-axis chart displaying the $850\text{ kWac}$ power plateau aligned with inverter heatsink temperature spiking above $78.5^\circ\text{C}$.
   - **Tab 2 (Why the Engine Thinks This)**: Review the rule evidence bullets ($45\%$) and the top 5 signed **ML Feature ContributionBars** ($55\%$) showing local SHAP contributions.
   - **Tab 3 (Ruled Out)**: Point out why Cloud Transients, Uniform Soiling, and Grid Curtailment were explicitly ruled out with mathematical justifications.
   - **Data Quality Note**: Point out the $-4.2\%$ confidence penalty applied for non-stationary samples.
2. **The Right Column**:
   - Point out the asset card (`INV-04`, `SMA Central 1250-CP`), the quantified 30-day loss (`INR 38,340`), and the technician LOTO safety notice.
   - Click **"Create work order"**: Notice the prefilled drawer pops up, submit it, and observe the toast notification.
3. **Work Orders Kanban (`/app/work-orders`)**:
   - Navigate to `/app/work-orders`.
   - Point out the 5-column Kanban: `Open`, `Dispatched`, `In Progress`, `Resolved`, `Verified`.
   - Drag a card and show that it **tilts 1 degree** while dragging.
   - Click **"Verify Restored"** on a resolved ticket:
     Watch the modal pop up displaying:
     `"Recovered 412 kWh/day · INR 1,298/day"` with an animated count-up.

---

## Act 4: Live Crucible Sandbox & Quality Audit (2:30 - 4:00)
**URL**: `/app/lab` &rarr; `/app/data-health` &rarr; `/app/model`

1. **Scenario Lab (`/app/lab`)**:
   - Show the left controls: plant selector, seed with randomizer, fault toggles with spring switches.
   - Click the **"Throw Clouds at It"** button:
     Watch the Web Worker process 2,016 intervals under monsoon dynamics ($VI = 2.18$).
     Point out the result: **0 False Alarms Flagged**!
   - Select the `soiling_plus_derating` preset, adjust the derating slider to $800\text{ kW}$, and click **"Run Engine"**.
   - Watch the 6 pipeline blocks light amber sequentially, reporting real execution latency ($120\text{ ms}$).
   - Compare **"Injected (Ground Truth)" vs "Detected"**: $100\%$ precision and $100\%$ recall.
2. **Data Health & Drift Correction (`/app/data-health`)**:
   - Select **Kurnool East**.
   - Show the Pyranometer Drift card: WMS POA reads $+8.1\%$ higher than fleet-implied consensus.
   - Highlight the engine action line: *"Using corrected series for diagnosis since 12 Mar"*.
   - Toggle **"Show results without sanity checks"**:
     Watch the alert appear: $+8$ false soiling alarms generated when uncalibrated raw data is used.
3. **Model Report Benchmark (`/app/model`)**:
   - Show Section 1: Confusion Matrix and per-class F1-scores ($96.8\%$ overall accuracy).
   - Show Section 3: Scatter plot $y=x$ proving quantification precision ($2.8\%$ MAPE).
   - Click **"Run Benchmark"** under Scalability:
     Watch the Web Worker compute synthetic plants, reaching over **2,200 inverter-days per second**.
