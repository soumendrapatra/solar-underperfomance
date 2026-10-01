# Kiran RCA - Project Context

## What we are building
A web prototype of a solar PV underperformance diagnosis and root-cause engine for O&M teams. It compares expected vs actual generation, isolates the failure mode, quantifies energy and revenue loss, and produces plain-language prescriptive work orders. Three layers:
1. Telemetry ingestion and baseline modeling (SCADA + weather station + physics digital twin)
2. Root-cause engine (yield gap, transient filtering, rule fingerprinting, Random Forest classifier, fusion)
3. Decision support (prescriptive actions, financial loss, priority, CMMS-style work orders)

Failure modes to detect: uniform soiling, partial shading, inverter thermal derating, inverter clipping (normal, not a fault), string open circuit, string mismatch / bypass diode failure, grid curtailment, pyranometer calibration drift. Must NOT flag cloud transients or normal diurnal ramps.

## Tech
Vite + React 18 (JavaScript, JSDoc types where useful), Tailwind CSS v3, Framer Motion, GSAP + ScrollTrigger + Lenis (landing only), Recharts + custom SVG with d3-scale and d3-shape, Zustand, React Router v6, PapaParse, Vitest. The engine runs in a Web Worker. Fully static deploy on Vercel or Netlify. No backend is required except one optional serverless function.

## Design rules (strict)
- Aesthetic: control room meets engineering notebook. Editorial, technical, calm.
- Colors: paper #F3F0E8, paper-2 #EAE6DB, ink #16150F, ink-2 #4A473D, line #D6D1C4, accent amber #D9790B, fault #B4441E, warn #B98A12, ok #4F6B2A, info #2F5D7C. Console dark mode: bg #121210, panel #1A1A17, line #2C2B26, text #E9E6DC.
- Fonts: "Fraunces" for large headings only (opsz, weight 400-500), "IBM Plex Sans" for UI, "IBM Plex Mono" for all numbers, IDs, units, and small uppercase labels.
- Border radius max 4px. 1px hairline borders. Almost no shadows. No gradients except a very subtle amber glow on the hero sun.
- No emoji anywhere. No glassmorphism. No purple. No neon. No "AI-powered magic" copy. No exclamation marks in UI copy.
- Numbers always use tabular figures with units in mono: "412.6 kW", "-18.2 %", "INR 14,820".
- Labels are small uppercase mono with letter-spacing 0.08em, e.g. "EXPECTED POWER".
- Use realistic asset naming: plant "Bhadla Block C" (Rajasthan, 12.4 MWp DC / 10 MWac), inverters INV-01..INV-08, combiner boxes SCB-xx, strings Sxx.
- Copy should sound like an experienced O&M engineer wrote it: short, specific, no buzzwords.
- Motion: purposeful and quick (150-450 ms), ease [0.22, 1, 0.36, 1]. Respect prefers-reduced-motion everywhere.

## Code rules
- Small focused modules. Pure functions in /engine with no React imports.
- Comments only where the physics or logic is non-obvious. No comment on every line.
- Deterministic seeded randomness (mulberry32) so demos are repeatable.
- Every engine module gets unit tests in /tests.
