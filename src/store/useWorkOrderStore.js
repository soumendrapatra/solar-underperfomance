/**
 * CMMS Work Order Store (Zustand).
 * Manages O&M maintenance tickets with standard lifecycle:
 * open -> dispatched -> in_progress -> resolved -> verified.
 * Tracks technician assignments, field notes, lifecycle audit history,
 * and computes recovered energy (kWh/day) and revenue when moved to verified.
 * Persists to localStorage.
 */

import { create } from 'zustand'

const STORAGE_KEY = 'kiran_work_orders'

function loadFromStorage() {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    console.warn('[useWorkOrderStore] Failed loading tickets from localStorage:', err)
    return []
  }
}

function saveToStorage(tickets) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets))
  } catch (err) {
    console.warn('[useWorkOrderStore] Failed saving tickets to localStorage:', err)
  }
}

export const WORK_ORDER_STATUSES = [
  'open',
  'dispatched',
  'in_progress',
  'resolved',
  'verified',
]

export const useWorkOrderStore = create((set, get) => ({
  tickets: loadFromStorage(),

  /**
   * Imports newly diagnosed prescriptive work orders, avoiding duplicate active tickets.
   */
  createFromDiagnosis: (plantId, newOrders = []) => {
    const currentTickets = [...get().tickets]
    let addedCount = 0

    for (const order of newOrders) {
      // Check if an unresolved ticket for this asset and mode already exists
      const exists = currentTickets.some(
        (t) =>
          t.plantId === plantId &&
          t.assetId === order.assetId &&
          t.mode === order.mode &&
          t.status !== 'verified'
      )

      if (!exists) {
        const ticket = {
          ...order,
          plantId,
          status: 'open',
          assignee: null,
          notes: [],
          history: [
            {
              from: null,
              to: 'open',
              timestamp: new Date().toISOString(),
              note: 'Generated automatically from diagnostic fusion engine.',
            },
          ],
          recoveredKWhPerDay: null,
          recoveredRevenuePerDay: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        currentTickets.push(ticket)
        addedCount++
      }
    }

    if (addedCount > 0) {
      saveToStorage(currentTickets)
      set({ tickets: currentTickets })
    }
  },

  /**
   * Advances or moves a ticket along the lifecycle status pipeline.
   * When moved to 'verified', calculates recovered energy per day and revenue.
   */
  move: (id, newStatus, note = '') => {
    const updated = get().tickets.map((t) => {
      if (t.id !== id) return t

      const oldStatus = t.status
      const historyItem = {
        from: oldStatus,
        to: newStatus,
        timestamp: new Date().toISOString(),
        note: note || `Status changed from ${oldStatus} to ${newStatus}.`,
      }

      const ticketCopy = {
        ...t,
        status: newStatus,
        history: [...(t.history || []), historyItem],
        updatedAt: new Date().toISOString(),
      }

      // On move to verified: re-compute recovered metrics
      if (newStatus === 'verified') {
        const recoveredKWhPerDay = Math.round(((t.lostKWh || 120) / 7.0) * 10) / 10
        const recoveredRevenuePerDay = Math.round(((t.lostRevenue || 380) / 7.0))
        ticketCopy.recoveredKWhPerDay = recoveredKWhPerDay
        ticketCopy.recoveredRevenuePerDay = recoveredRevenuePerDay
      }

      return ticketCopy
    })

    saveToStorage(updated)
    set({ tickets: updated })
  },

  /**
   * Assigns a ticket to a field technician or O&M lead.
   */
  assign: (id, assignee) => {
    const updated = get().tickets.map((t) => {
      if (t.id !== id) return t
      return {
        ...t,
        assignee,
        status: t.status === 'open' ? 'dispatched' : t.status,
        updatedAt: new Date().toISOString(),
        history: [
          ...(t.history || []),
          {
            from: t.status,
            to: t.status === 'open' ? 'dispatched' : t.status,
            timestamp: new Date().toISOString(),
            note: `Assigned to ${assignee}`,
          },
        ],
      }
    })

    saveToStorage(updated)
    set({ tickets: updated })
  },

  /**
   * Appends a technician or engineer note to a ticket.
   */
  addNote: (id, text, author = 'Field Engineer') => {
    const updated = get().tickets.map((t) => {
      if (t.id !== id) return t
      const noteItem = {
        id: `note-${Date.now()}`,
        author,
        text,
        timestamp: new Date().toISOString(),
      }
      return {
        ...t,
        notes: [...(t.notes || []), noteItem],
        updatedAt: new Date().toISOString(),
      }
    })

    saveToStorage(updated)
    set({ tickets: updated })
  },

  /**
   * Clears all verified or all tickets.
   */
  clearTickets: () => {
    saveToStorage([])
    set({ tickets: [] })
  },
}))
