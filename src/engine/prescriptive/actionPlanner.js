/**
 * Prescriptive Action Planner.
 * Generates deterministic CMMS-style work orders with technician checklists,
 * tools, safety procedures, financial loss impacts, and O&M priority scores.
 * Uses exact requested sentence shape:
 * "Generation is X % below expected. Likely causes: Y. Recommended action: Z."
 * Pure JavaScript, no external dependencies.
 */

import { mulberry32 } from '../simulator/rng.js'
import { ACTION_TEMPLATES } from './actionTemplates.js'
import { calculatePriority } from './priority.js'
import { quantifyFinancialLoss } from './financial.js'

/**
 * Builds deterministic prescriptive work orders from fused diagnostic issues.
 *
 * @param {Array<object>} fusedModes - Detected modes from fusion.js
 * @param {object} context
 * @param {number} [context.overallLossPct=0.18] - Whole plant or inverter loss fraction
 * @param {number} [context.lostKWh=450] - Lost energy in kWh
 * @param {number} [context.tariff=3.15] - Tariff in INR/kWh
 * @param {number} [context.seed=42] - PRNG seed for repeatable text variant selection
 * @returns {Array<{
 *   id: string,
 *   assetId: string,
 *   mode: string,
 *   modeName: string,
 *   confidence: number,
 *   confidenceLabel: 'High' | 'Medium' | 'Low',
 *   lostKWh: number,
 *   lostRevenue: number,
 *   priority: 'P1' | 'P2' | 'P3',
 *   priorityScore: number,
 *   text: string,
 *   checklist: string[],
 *   estimatedEffort: string,
 *   tools: string[],
 *   safetyNote: string,
 *   status: 'open',
 *   createdAt: string
 * }>}
 */
export function generateWorkOrders(fusedModes, context = {}) {
  const {
    overallLossPct = 0.18,
    lostKWh = 450,
    tariff = 3.15,
    seed = 42,
  } = context

  const rand = mulberry32(seed)
  const workOrders = []
  let ticketIndex = 1

  // Map financial losses across active modes
  const totalFinancials = quantifyFinancialLoss(lostKWh, 7, { tariff })

  for (const item of fusedModes) {
    // Only hardware ticket eligible modes become physical work orders
    // Clipping, curtailment, and sensor drift are excluded from hardware tickets
    if (item.category === 'not_equipment_fault' || item.isHardwareTicket === false) {
      continue
    }

    const mode = item.mode
    const template = ACTION_TEMPLATES[mode] || {
      name: mode.replace(/_/g, ' '),
      likelyCauses: [`${mode.replace(/_/g, ' ')} and ambient thermal stress`],
      recommendedActions: [`inspect {assetId} and verify operating conditions`],
      checklist: [
        'Inspect asset physical condition',
        'Verify voltage and current readings against expected model',
        'Check SCADA event log for fault codes',
      ],
      estimatedEffort: '1.5 hours',
      tools: ['Digital multimeter', 'Standard O&M tool set'],
      safetyNote: 'Follow standard site safety guidelines and Arc Flash PPE requirements.',
    }

    // Deterministically pick variant 0 or 1 using the seeded PRNG
    const variantIdx = rand() < 0.5 ? 0 : 1
    const rawCause = template.likelyCauses[variantIdx % template.likelyCauses.length]
    const rawAction = template.recommendedActions[variantIdx % template.recommendedActions.length]

    const assetId = item.assetId || 'Bhadla Block C'
    const causes = rawCause.replace(/\{assetId\}/g, assetId)
    const action = rawAction.replace(/\{assetId\}/g, assetId)

    // Form exact required text shape:
    // "Generation is 18 % below expected. Likely causes: inverter derating and high module temperature. Recommended action: inspect INV-02 and verify cooling conditions."
    const lossPctInt = Math.round(overallLossPct * 100)
    const text = `Generation is ${lossPctInt} % below expected. Likely causes: ${causes}. Recommended action: ${action}.`

    // Allocate share of financial loss to this fault mode
    const modeShare = Math.max(0.2, item.confidence / Math.max(1, fusedModes.length))
    const modeLostKWh = Math.round(lostKWh * modeShare * 10) / 10
    const modeLostRevenue = Math.round(modeLostKWh * tariff)
    const dailyRevenueLoss = Math.round(modeLostRevenue / 7)

    // Compute maintenance priority (P1/P2/P3)
    const priorityResult = calculatePriority({
      revenueAtRiskPerDay: Math.max(80, dailyRevenueLoss),
      mode,
      confidence: item.confidence,
    })

    const woId = `WO-${new Date().getFullYear()}-${String(ticketIndex++).padStart(3, '0')}`

    workOrders.push({
      id: woId,
      assetId,
      mode,
      modeName: template.name,
      confidence: item.confidence,
      confidenceLabel: item.confidenceLabel,
      lostKWh: modeLostKWh,
      lostRevenue: modeLostRevenue,
      priority: priorityResult.priority,
      priorityScore: priorityResult.score,
      text,
      checklist: template.checklist,
      estimatedEffort: template.estimatedEffort,
      tools: template.tools,
      safetyNote: template.safetyNote,
      status: 'open',
      createdAt: new Date().toISOString(),
    })
  }

  // Sort work orders by priority (P1 first, then P2, then P3)
  const priorityOrder = { P1: 0, P2: 1, P3: 2 }
  workOrders.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return workOrders
}
