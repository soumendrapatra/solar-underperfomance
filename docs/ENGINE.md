# Kiran RCA — Physics Digital Twin Engine

## Architecture Overview

The physics engine is Layer 1 of Kiran RCA. It serves as the baseline digital twin for solar PV plants. Given environmental observations (POA irradiance, ambient temperature, and wind speed), the engine calculates the theoretical, un-faulted electrical generation expected at the string, inverter, and plant boundary.

All physics functions are pure JavaScript modules in `src/engine/physics/`, free of React or UI dependencies, enabling seamless execution in Web Workers, Node.js test runners, and serverless runtimes.

---

## 1. Solar Geometry & Celestial Position (`solarPosition.js`)

To accurately separate tracking misalignment, horizon shading, and diurnal ramp cycles from true electrical faults, the engine calculates the sun's position using the NOAA Solar Position Algorithm (Spencer / Michalsky formulation).

### 1.1 Time Epoch and Julian Calculations

Given any local timestamp in Indian Standard Time (IST, UTC+05:30), the engine computes the Julian Day ($JD$) and Julian Century ($JC$):

$$JC = \frac{JD - 2451545.0}{36525.0}$$

### 1.2 Solar Declination and Equation of Time

The sun's mean anomaly ($M$), geometric mean longitude ($L_0$), and equation of center ($C$) yield the apparent solar longitude ($\lambda$) and true obliquity of the ecliptic ($\epsilon$). The solar declination ($\delta$) is determined by:

$$\sin(\delta) = \sin(\epsilon) \cdot \sin(\lambda)$$

The Equation of Time ($EoT$, in minutes) accounts for the eccentricity of Earth's elliptical orbit and axial tilt:

$$EoT = 4 \cdot \left( y \sin(2 L_0) - 2 e \sin(M) + 4 e y \sin(M) \cos(2 L_0) - \frac{1}{2} y^2 \sin(4 L_0) - \frac{5}{4} e^2 \sin(2 M) \right)$$

where $y = \tan^2(\epsilon / 2)$ and $e$ is Earth's orbital eccentricity.

### 1.3 Local Solar Time and Hour Angle

Local Solar Time ($LST$) corrects civil clock time for the plant's local longitude ($\lambda_{plant}$) relative to the standard meridian ($\lambda_{std} = 82.5^\circ\text{E}$ for IST):

$$LST = \text{Time}_{IST} + \frac{EoT + 4 \cdot (\lambda_{plant} - 82.5^\circ)}{60}$$

The solar hour angle ($H$) measures the sun's angular displacement west of the local meridian:

$$H = (LST - 12.0) \cdot 15^\circ$$

### 1.4 Zenith, Elevation, and Azimuth

The topocentric solar zenith angle ($\theta_z$) and solar elevation angle ($\alpha = 90^\circ - \theta_z$) are derived from spherical trigonometry:

$$\cos(\theta_z) = \sin(\phi) \sin(\delta) + \cos(\phi) \cos(\delta) \cos(H)$$

where $\phi$ is the plant latitude. For Bhadla Block C ($\phi = 27.5^\circ\text{N}$), at local solar noon on the summer solstice ($\delta \approx +23.44^\circ$, $H = 0^\circ$):

$$\theta_z = 27.5^\circ - 23.44^\circ = 4.06^\circ \implies \alpha = 85.94^\circ \approx 86^\circ$$

Atmospheric refraction is corrected via the Saemundsson formulation for low elevation angles. Solar azimuth ($\gamma_s$) is computed relative to True North ($0^\circ$).

---

## 2. Cell & Module Thermal Dynamics (`cellTemperature.js`)

Silicon PV cell efficiency degrades at elevated temperatures. Because internal semiconductor junction temperatures ($T_c$) cannot be measured directly in utility-scale SCADA, the engine uses the Sandia Array Performance Model (SAPM) for open-rack glass/cell/polymer backsheet installations (King et al., Sandia Report SAND2004-5235).

### 2.1 Module Back-Surface Temperature ($T_m$)

Module back-surface temperature balances radiative absorption against convective and conductive cooling driven by ambient air temperature ($T_a$) and local wind speed ($WS$):

$$T_m = E \cdot \exp(a + b \cdot WS) + T_a$$

- $E$: Plane-of-Array (POA) irradiance ($\text{W/m}^2$)
- $WS$: Wind speed at 10m elevation ($\text{m/s}$)
- $T_a$: Ambient air temperature ($^\circ\text{C}$)
- $a = -3.56$: Empirically fitted thermal conductance coefficient
- $b = -0.075$: Wind cooling coefficient

Under standard conditions ($E = 1000\text{ W/m}^2$, $T_a = 25^\circ\text{C}$, $WS = 1.0\text{ m/s}$):
$$T_m = 1000 \cdot \exp(-3.56 - 0.075 \cdot 1.0) + 25 = 1000 \cdot \exp(-3.635) + 25 \approx 26.38 + 25 = 51.38^\circ\text{C}$$

### 2.2 Internal Cell Junction Temperature ($T_c$)

Heat generated within the silicon wafer must conduct through the ethylene vinyl acetate (EVA) encapsulant and polymer backsheet, creating a thermal gradient ($\Delta T$):

$$T_c = T_m + \left( \frac{E}{1000} \right) \cdot \Delta T$$

- $\Delta T = 3.0^\circ\text{C}$ for open-rack utility mounting.

### 2.3 Sensor Validation and Measured Fallback

When a physical back-of-module resistance temperature detector (RTD) exists in telemetry, the engine validates the reading against physical boundary envelopes:
1. Range bounds: $-15^\circ\text{C} \le T_{bom} \le 95^\circ\text{C}$
2. Insolation consistency: Under high sun ($E > 100\text{ W/m}^2$), $T_{bom} \ge T_a - 4.0^\circ\text{C}$
3. Thermal ceiling: $T_{bom} \le T_a + 55.0^\circ\text{C}$

If valid, $T_{bom}$ is preferred directly; otherwise, the engine falls back to SAPM and records `source: 'sapm_modeled'` to ensure audit traceability.

---

## 3. DC Array Electrical Translation (`dcModel.js`)

The DC array model translates environmental insolation ($POA$) and junction temperature ($T_c$) into available DC power and expected string electrical characteristics.

### 3.1 DC Power Model

DC power scales linearly with effective insolation, derated by junction temperature and fixed balance-of-system (BOS) electrical losses:

$$P_{dc} = P_{dc0} \cdot \left( \frac{POA}{1000} \right) \cdot [1 + \gamma \cdot (T_c - 25)] \cdot (1 - \eta_{sys})$$

- $P_{dc0}$: Nameplate array DC rating at Standard Test Conditions ($1000\text{ W/m}^2$, $25^\circ\text{C}$, AM 1.5G)
- $\gamma$: Maximum power temperature coefficient ($-0.0035 / ^\circ\text{C}$ for monocrystalline PERC / TOPCon)
- $\eta_{sys} = 0.03$: Baseline DC system losses ($3\%$) encompassing DC string wiring ohmic drop ($I^2R$), combiner box disconnects, and module manufacturing bin tolerance.
- Unsoiled baseline assumption: Soiling derate is set to $0$ in the reference baseline model. Any deviation between actual generation and this reference forms the yield gap analyzed in Layer 2.

**Sensitivity**:
- Irradiance linearity: At constant $T_c$, doubling $POA$ strictly doubles $P_{dc}$.
- Temperature sensitivity: Every $+10^\circ\text{C}$ rise above $25^\circ\text{C}$ reduces $P_{dc}$ by exactly $3.5\%$.

### 3.2 String Current Model ($I_{string}$)

Expected string operating current scales directly with irradiance, with a slight positive temperature coefficient ($\alpha_{Isc}$):

$$I_{string} = I_{mp} \cdot \left( \frac{POA}{1000} \right) \cdot [1 + \alpha_{Isc} \cdot (T_c - 25)]$$

- $I_{mp} = 13.04\text{ A}$ (STC current at maximum power point)
- $\alpha_{Isc} = +0.0005 / ^\circ\text{C}$ ($+0.05\% / ^\circ\text{C}$)

This provides the reference benchmark for the String Open Circuit rule (flagging strings below $0.3\text{ A}$ when adjacent strings carry $> 8\text{ A}$) and String Mismatch / Partial Shading rules.

---

## 4. Inverter Conversion & Dynamic Clipping (`inverterModel.js`)

Central inverters convert DC power to grid-synchronized AC power. Inverter efficiency is non-linear, dropping at part load due to magnetic core excitation and control tare consumption, and plateauing at high load before encountering the thermal or nameplate AC export ceiling.

### 4.1 PVWatts Empirical Part-Load Efficiency Curve

The engine implements the NREL PVWatts Version 5 inverter model (Dobos, 2014, NREL/TP-5200-60272):

$$\eta(\zeta) = \frac{\eta_{nom}}{\eta_{ref}} \cdot \left( -0.0162 \cdot \zeta - \frac{0.0059}{\zeta} + 0.9858 \right)$$

where:
- $\eta_{nom} = 0.985$ ($98.5\%$ nominal weighted CEC efficiency)
- $\eta_{ref} = -0.0162 - 0.0059 + 0.9858 = 0.9637$ (normalization constant ensuring $\eta = \eta_{nom}$ at rated load)
- $\zeta = \frac{P_{dc}}{P_{dc0}}$ (normalized load ratio, where $P_{dc0} = P_{ac0} / \eta_{nom}$)

If $\zeta \le 0.005$, the inverter is below the tare threshold ($P_{ac} = 0$, status `OFFLINE`).

### 4.2 AC Generation and Normal Clipping Ceiling

Unclipped AC power is:
$$P_{ac\_unclipped} = P_{dc} \cdot \eta(\zeta)$$

Because utility PV plants are engineered with DC/AC overbuild ratios between $1.20$ and $1.35$ (for Bhadla Block C, DC/AC = $1.24$), available DC power at midday frequently exceeds the inverter's maximum continuous AC rating ($P_{ac0} = 1250\text{ kW}$):

$$P_{ac\_expected} = \min(P_{ac0}, P_{ac\_unclipped})$$

$$\text{isClippingExpected} = (P_{ac\_unclipped} \ge P_{ac0})$$

**Key Distinction**: Inverter clipping is a normal economic design outcome, not a plant failure mode. By modeling $P_{ac0}$ saturation explicitly, the root-cause engine avoids falsely categorizing peak-hour flattening as thermal derating or grid curtailment.

---

## 5. Dual-Stream Telemetry Validation (`expectedPower.js`)

Field pyranometers (WMS) degrade over time due to optical soiling, desiccant saturation, and photodiode drift. If the engine relied solely on a fouled POA sensor, expected power would drop in tandem with the sensor, masking true generation losses or falsely inflating apparent plant Performance Ratio (PR).

The engine provides dual-stream execution:
1. **Primary Stream**: Ingests field pyranometer observations ($POA_{obs}$).
2. **Reference Stream**: Calculates expected generation from the synthetic clear-sky digital twin ($POA_{clear}$).

When actual inverter generation matches $POA_{clear}$ while $POA_{obs}$ reads $6\% - 12\%$ low, the root-cause engine isolates a **Pyranometer Drift Fault** on the WMS rather than an inverter or string problem.
