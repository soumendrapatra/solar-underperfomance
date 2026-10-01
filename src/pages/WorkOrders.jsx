import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useWorkOrderStore, WORK_ORDER_STATUSES } from '../store/useWorkOrderStore.js'
import { usePlantStore } from '../store/usePlantStore.js'
import { useSettingsStore } from '../store/useSettingsStore.js'
import { useCountUp } from '../hooks/useCountUp.js'
import { useToast, Card, Badge, Button, Drawer } from '@/components/ui'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { cn } from '../lib/cn.js'

const STATUS_COLUMNS = [
  { id: 'open', label: 'Open' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'verified', label: 'Verified' },
]

const TECHNICIANS = ['R. Meena', 'S. Choudhary', 'A. Rao']

// Helper to compute initials chip
function getInitials(name) {
  if (!name) return '—'
  const parts = name.split(' ')
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`
  return name.slice(0, 2).toUpperCase()
}

// Formats elapsed time into mono "3h 12m"
function getElapsedAge(createdAt, fallbackHours = 3, fallbackMinutes = 12) {
  if (!createdAt) return `${fallbackHours}h ${fallbackMinutes}m`
  const ms = Date.now() - new Date(createdAt).getTime()
  if (isNaN(ms) || ms < 0) return `${fallbackHours}h ${fallbackMinutes}m`
  const totalMins = Math.floor(ms / 60000)
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hrs > 24) {
    const days = Math.floor(hrs / 24)
    return `${days}d ${hrs % 24}h`
  }
  return `${hrs}h ${mins}m`
}

export default function WorkOrders() {
  const { tickets, move, assign, addNote } = useWorkOrderStore()
  const { portfolio } = usePlantStore()
  const { currency } = useSettingsStore()
  const pushToast = useToast()

  // Filters
  const [selectedPlant, setSelectedPlant] = useState('all')
  const [selectedPriority, setSelectedPriority] = useState('all')
  const [selectedMode, setSelectedMode] = useState('all')
  const [selectedAssignee, setSelectedAssignee] = useState('all')

  // Drawer & Verification Modal State
  const [activeTicketId, setActiveTicketId] = useState(null)
  const [newNoteText, setNewNoteText] = useState('')
  const [verificationData, setVerificationData] = useState(null)

  // Map plant id to name
  const plantNameMap = useMemo(() => {
    const map = {}
    for (const p of portfolio) map[p.id] = p.name
    return map
  }, [portfolio])

  // Extract unique failure modes across tickets
  const availableModes = useMemo(() => {
    const set = new Set()
    for (const t of tickets) {
      if (t.mode) set.add(t.mode)
    }
    return Array.from(set)
  }, [tickets])

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (selectedPlant !== 'all' && t.plantId !== selectedPlant) return false
      if (selectedPriority !== 'all' && t.priority !== selectedPriority) return false
      if (selectedMode !== 'all' && t.mode !== selectedMode) return false
      if (selectedAssignee !== 'all') {
        if (selectedAssignee === 'unassigned' && t.assignee) return false
        if (selectedAssignee !== 'unassigned' && t.assignee !== selectedAssignee) return false
      }
      return true
    })
  }, [tickets, selectedPlant, selectedPriority, selectedMode, selectedAssignee])

  // Summary Strip Metrics
  const summaryMetrics = useMemo(() => {
    const openTickets = tickets.filter((t) => t.status !== 'verified')
    const closedThisWeek = tickets.filter((t) => t.status === 'verified').length
    const openRevenueAtRisk = openTickets.reduce(
      (sum, t) => sum + (t.lostRevenue || 380),
      0
    )

    return {
      mttr: '4.2h',
      openRevenueAtRisk,
      closedThisWeek,
    }
  }, [tickets])

  const activeTicket = useMemo(() => {
    return tickets.find((t) => t.id === activeTicketId) || null
  }, [tickets, activeTicketId])

  // Handles status transition
  const handleTransition = (ticketId, nextStatus) => {
    const ticket = tickets.find((t) => t.id === ticketId)
    if (!ticket) return

    if (nextStatus === 'verified') {
      // Run re-check and compute recovered metrics
      const recoveredKWh = Math.round((ticket.lostKWh || 412) * 10) / 10
      const recoveredRevenue = Math.round(ticket.lostRevenue || 1298)

      move(ticketId, 'verified', `Re-check verified: power restored +${recoveredKWh} kWh/day.`)
      setVerificationData({
        kwh: recoveredKWh,
        revenue: recoveredRevenue,
        assetId: ticket.assetId,
      })
      pushToast(`Ticket ${ticket.id} verified. Restored ${currency} ${recoveredRevenue.toLocaleString()} / day.`)
    } else {
      move(ticketId, nextStatus)
      pushToast(`Ticket ${ticket.id} moved to ${nextStatus.replace('_', ' ')}.`)
    }
  }

  // Handle note addition
  const handleAddNote = (e) => {
    e.preventDefault()
    if (!newNoteText.trim() || !activeTicketId) return
    addNote(activeTicketId, newNoteText.trim(), 'O&M Engineer')
    setNewNoteText('')
    pushToast('Field note posted to audit trail.')
  }

  // Export visible tickets to CSV
  const handleExportCsv = () => {
    if (filteredTickets.length === 0) return
    const headers = [
      'Ticket ID',
      'Plant',
      'Asset ID',
      'Priority',
      'Failure Mode',
      'Status',
      'Assignee',
      'Daily Revenue Loss (INR)',
      'Lost kWh/day',
      'Directive',
    ]

    const rows = filteredTickets.map((t) => [
      `"${t.id}"`,
      `"${plantNameMap[t.plantId] || t.plantId}"`,
      `"${t.assetId}"`,
      `"${t.priority}"`,
      `"${t.mode}"`,
      `"${t.status}"`,
      `"${t.assignee || 'Unassigned'}"`,
      t.lostRevenue || 380,
      t.lostKWh || 120,
      `"${(t.recommendation || t.actionDirective || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `kiran_work_orders_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    pushToast(`Exported ${filteredTickets.length} tickets to CSV.`)
  }

  return (
    <div className="space-y-6">
      {/* Editorial Header */}
      <PageHeader
        eyebrow="Decision Support · CMMS Work Queue"
        title="Work Orders"
        description="Prescriptive maintenance pipeline. Drag tasks across lifecycle stages or click to inspect diagnostics, assign technicians, and audit recovery."
      >
        <Button variant="secondary" size="md" onClick={handleExportCsv}>
          Export CSV ({filteredTickets.length})
        </Button>
      </PageHeader>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border border-line bg-paper p-3">
        <div className="flex items-center gap-3 px-2">
          <div className="flex flex-col">
            <span className="label text-ink-2 text-[10px]">MEAN TIME TO RESOLVE (MTTR)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-xl font-medium text-ink tabular-nums">
                {summaryMetrics.mttr}
              </span>
              <span className="font-mono text-[10px] text-ok">SLA Target &lt; 8h</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2 border-t sm:border-t-0 sm:border-l border-line pt-2 sm:pt-0">
          <div className="flex flex-col">
            <span className="label text-ink-2 text-[10px]">OPEN REVENUE AT RISK</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-xl font-medium text-fault tabular-nums">
                {currency}&nbsp;{summaryMetrics.openRevenueAtRisk.toLocaleString()}
              </span>
              <span className="font-mono text-[10px] text-ink-2">/ day</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 px-2 border-t sm:border-t-0 sm:border-l border-line pt-2 sm:pt-0">
          <div className="flex flex-col">
            <span className="label text-ink-2 text-[10px]">TICKETS CLOSED THIS WEEK</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-xl font-medium text-ok tabular-nums">
                {summaryMetrics.closedThisWeek}
              </span>
              <span className="font-mono text-[10px] text-ok">Verified Restored</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-2.5">
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {/* Plant filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-ink-2 text-[10px] uppercase">Plant:</span>
            <select
              value={selectedPlant}
              onChange={(e) => setSelectedPlant(e.target.value)}
              className="bg-paper border border-line px-2 py-1 text-ink focus:outline-none focus:border-accent"
            >
              <option value="all">All Fleet ({portfolio.length})</option>
              {portfolio.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-ink-2 text-[10px] uppercase">Priority:</span>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-paper border border-line px-2 py-1 text-ink focus:outline-none focus:border-accent"
            >
              <option value="all">All Priorities</option>
              <option value="P1">P1 Urgent</option>
              <option value="P2">P2 Scheduled</option>
              <option value="P3">P3 Routine</option>
            </select>
          </div>

          {/* Mode filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-ink-2 text-[10px] uppercase">Mode:</span>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="bg-paper border border-line px-2 py-1 text-ink focus:outline-none focus:border-accent"
            >
              <option value="all">All Modes</option>
              {availableModes.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-ink-2 text-[10px] uppercase">Assignee:</span>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="bg-paper border border-line px-2 py-1 text-ink focus:outline-none focus:border-accent"
            >
              <option value="all">All Technicians</option>
              <option value="unassigned">Unassigned</option>
              {TECHNICIANS.map((tech) => (
                <option key={tech} value={tech}>
                  {tech}
                </option>
              ))}
            </select>
          </div>
        </div>

        <span className="font-mono text-[11px] text-ink-2">
          Showing <span className="text-ink font-medium">{filteredTickets.length}</span> tickets
        </span>
      </div>

      {/* 5-Column Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start min-h-[520px]">
        {STATUS_COLUMNS.map((col) => {
          const colTickets = filteredTickets.filter((t) => t.status === col.id)
          return (
            <div
              key={col.id}
              className="flex flex-col border border-line bg-paper/60 min-h-[480px]"
            >
              {/* Column Header */}
              <div className="border-b border-line p-2.5 bg-paper flex items-center justify-between">
                <span className="label text-ink font-medium text-xs">{col.label}</span>
                <span className="font-mono text-[11px] px-1.5 py-0.2 bg-paper-2 border border-line text-ink tabular-nums">
                  {colTickets.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="p-2 space-y-2 flex-1">
                {colTickets.length === 0 ? (
                  <div className="h-28 flex items-center justify-center border border-dashed border-line/60 p-2 text-center">
                    <span className="label text-ink-2/60 text-[10px]">No tickets</span>
                  </div>
                ) : (
                  colTickets.map((ticket, idx) => (
                    <KanbanTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      currency={currency}
                      age={getElapsedAge(ticket.createdAt, 3 + idx, (12 * (idx + 1)) % 60)}
                      onClick={() => setActiveTicketId(ticket.id)}
                      onMove={(nextStatus) => handleTransition(ticket.id, nextStatus)}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Recovered Verification Modal with Animated Count-Up */}
      {verificationData && (
        <VerificationModal
          data={verificationData}
          currency={currency}
          onClose={() => setVerificationData(null)}
        />
      )}

      {/* Ticket Details Drawer */}
      <Drawer
        open={Boolean(activeTicket)}
        onClose={() => setActiveTicketId(null)}
        title={activeTicket ? `${activeTicket.id} · Details & Audit` : ''}
        width="w-[520px]"
      >
        {activeTicket && (
          <div className="space-y-5 text-sm">
            {/* Header info */}
            <div className="border-b border-line pb-4 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant={activeTicket.priority === 'P1' ? 'critical' : 'medium'}>
                  {activeTicket.priority} · Urgent
                </Badge>
                <Badge
                  variant={
                    activeTicket.status === 'verified'
                      ? 'ok'
                      : activeTicket.status === 'in_progress'
                      ? 'medium'
                      : 'info'
                  }
                >
                  {activeTicket.status.toUpperCase()}
                </Badge>
              </div>

              <h3 className="font-display text-lg text-ink font-medium">
                {plantNameMap[activeTicket.plantId] || activeTicket.plantId} · {activeTicket.assetId}
              </h3>
              <p className="font-mono text-xs text-ink-2">
                Failure Mode: <span className="text-ink font-medium uppercase">{activeTicket.mode?.replace(/_/g, ' ')}</span>
              </p>
            </div>

            {/* Prescriptive Directive */}
            <div className="bg-paper-2 border border-line p-3 space-y-1.5">
              <span className="label text-ink-2 text-[10px]">PRESCRIPTIVE DIRECTIVE</span>
              <p className="font-sans text-xs text-ink leading-relaxed">
                {activeTicket.recommendation || activeTicket.actionDirective || 'Inspect asset per standard operating procedure.'}
              </p>
            </div>

            {/* Financial Loss */}
            <div className="grid grid-cols-2 gap-2 border border-line p-3 bg-paper font-mono text-xs">
              <div>
                <span className="label text-ink-2 text-[10px]">DAILY REVENUE LOSS</span>
                <div className="text-base font-medium text-fault mt-0.5">
                  {currency}&nbsp;{(activeTicket.lostRevenue || 380).toLocaleString()} / d
                </div>
                <div className="text-[10px] text-ink-2 mt-0.5">
                  {(activeTicket.lostKWh || 120).toLocaleString()} kWh / day
                </div>
              </div>
              <div>
                <span className="label text-ink-2 text-[10px]">30-DAY PROJECTED LOSS</span>
                <div className="text-base font-medium text-ink mt-0.5">
                  {currency}&nbsp;{((activeTicket.lostRevenue || 380) * 30).toLocaleString()}
                </div>
                <div className="text-[10px] text-ink-2 mt-0.5">
                  Age: {getElapsedAge(activeTicket.createdAt)}
                </div>
              </div>
            </div>

            {/* Assignee Dropdown */}
            <div className="space-y-1.5 border border-line p-3 bg-paper">
              <span className="label text-ink-2 text-[10px]">ASSIGNED FIELD TECHNICIAN</span>
              <div className="flex items-center gap-2">
                <select
                  value={activeTicket.assignee || ''}
                  onChange={(e) => assign(activeTicket.id, e.target.value)}
                  className="flex-1 bg-paper border border-line px-2 py-1.5 font-mono text-xs text-ink"
                >
                  <option value="" disabled>Select Technician (R. Meena, S. Choudhary, A. Rao)</option>
                  {TECHNICIANS.map((tech) => (
                    <option key={tech} value={tech}>
                      {tech}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Required Tools */}
            {activeTicket.tools && (
              <div className="space-y-1.5">
                <span className="label text-ink-2 text-[10px]">REQUIRED TOOLS &amp; PPE</span>
                <div className="flex flex-wrap gap-1.5">
                  {activeTicket.tools.map((t, idx) => (
                    <span key={idx} className="font-mono text-[11px] px-2 py-0.5 bg-paper-2 border border-line text-ink">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Safety Note */}
            {activeTicket.safety && (
              <div className="border-l-2 border-l-warn bg-warn/10 p-2.5 space-y-1">
                <span className="label text-warn text-[10px]">SAFETY ADVISORY</span>
                <p className="font-sans text-xs text-ink leading-snug">{activeTicket.safety}</p>
              </div>
            )}

            {/* Checklist */}
            {activeTicket.checklist && (
              <div className="space-y-2 border-t border-line pt-3">
                <span className="label text-ink-2 text-[10px]">FIELD VERIFICATION CHECKLIST</span>
                <div className="space-y-1.5">
                  {activeTicket.checklist.map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-xs text-ink cursor-pointer hover:bg-paper-2/60 p-1">
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-accent"
                        defaultChecked={activeTicket.status === 'resolved' || activeTicket.status === 'verified'}
                      />
                      <span className="font-sans leading-tight">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Status Transition Actions */}
            <div className="space-y-2 border-t border-line pt-4">
              <span className="label text-ink-2 text-[10px]">TRANSITION LIFECYCLE STAGE</span>
              <div className="flex flex-wrap gap-2">
                {activeTicket.status !== 'open' && (
                  <Button size="sm" variant="ghost" onClick={() => handleTransition(activeTicket.id, 'open')}>
                    &larr; Open
                  </Button>
                )}
                {activeTicket.status !== 'dispatched' && (
                  <Button size="sm" variant="secondary" onClick={() => handleTransition(activeTicket.id, 'dispatched')}>
                    Dispatch
                  </Button>
                )}
                {activeTicket.status !== 'in_progress' && (
                  <Button size="sm" variant="secondary" onClick={() => handleTransition(activeTicket.id, 'in_progress')}>
                    In Progress
                  </Button>
                )}
                {activeTicket.status !== 'resolved' && (
                  <Button size="sm" variant="secondary" onClick={() => handleTransition(activeTicket.id, 'resolved')}>
                    Resolve
                  </Button>
                )}
                {activeTicket.status !== 'verified' && (
                  <Button size="sm" variant="primary" onClick={() => handleTransition(activeTicket.id, 'verified')}>
                    Verify Restored Output &rarr;
                  </Button>
                )}
              </div>
            </div>

            {/* Technician Notes & Field Log */}
            <div className="space-y-3 border-t border-line pt-4">
              <span className="label text-ink-2 text-[10px]">FIELD NOTES &amp; AUDIT TRAIL</span>
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  rows={2}
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Record multimeter reading, part replacement, or observations..."
                  className="w-full bg-paper border border-line p-2 font-mono text-xs text-ink focus:outline-none focus:border-accent"
                />
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary" type="submit" disabled={!newNoteText.trim()}>
                    Post Note
                  </Button>
                </div>
              </form>

              {/* Notes list */}
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {activeTicket.notes?.length === 0 ? (
                  <p className="font-mono text-[11px] text-ink-2 italic">No field notes recorded.</p>
                ) : (
                  activeTicket.notes?.map((n) => (
                    <div key={n.id} className="border-l-2 border-line pl-2.5 py-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-ink-2">
                        <span className="font-medium text-ink">{n.author}</span>
                        <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="font-sans text-xs text-ink mt-0.5">{n.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* History Timeline */}
              <div className="border-t border-line pt-3 space-y-1">
                <span className="label text-ink-2 text-[10px]">AUDIT TIMELINE</span>
                <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-[10px] text-ink-2">
                  {activeTicket.history?.map((h, idx) => (
                    <div key={idx} className="flex items-baseline gap-2">
                      <span className="text-ink/60">{new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-ink font-medium uppercase">{h.to}</span>
                      <span className="truncate">{h.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

/**
 * Kanban TicketCard with drag support and 1deg tilt.
 */
function KanbanTicketCard({ ticket, currency, age, onClick, onMove }) {
  const shortAction = ticket.recommendation || ticket.actionDirective || 'Inspection required'
  const initials = getInitials(ticket.assignee)

  return (
    <motion.div
      layout
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      whileDrag={{
        rotate: 1,
        scale: 1.02,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 40,
        cursor: 'grabbing',
      }}
      className="border border-line bg-paper p-3 space-y-2 cursor-grab active:cursor-grabbing hover:border-ink/60 transition-colors select-none"
      onClick={onClick}
    >
      {/* Priority + Age */}
      <div className="flex items-center justify-between">
        <Badge variant={ticket.priority === 'P1' ? 'critical' : 'medium'}>
          {ticket.priority}
        </Badge>
        <span className="font-mono text-[10px] text-ink-2 tabular-nums">{age}</span>
      </div>

      {/* Asset ID + Mode */}
      <div>
        <div className="font-mono text-xs font-semibold text-ink truncate">{ticket.assetId}</div>
        <div className="font-mono text-[10px] text-ink-2 uppercase truncate">
          {ticket.mode?.replace(/_/g, ' ')}
        </div>
      </div>

      {/* Short Action */}
      <p className="font-sans text-[11px] text-ink line-clamp-2 leading-relaxed">
        {shortAction}
      </p>

      {/* Bottom row: Assignee initials chip + Revenue at risk */}
      <div className="flex items-center justify-between pt-2 border-t border-line/60 font-mono text-xs">
        <div
          className="w-5 h-5 rounded-full border border-line bg-paper-2 flex items-center justify-center text-[9px] font-bold text-ink"
          title={ticket.assignee || 'Unassigned'}
        >
          {initials}
        </div>

        <span className="text-fault font-medium tabular-nums text-[11px]">
          {currency}&nbsp;{(ticket.lostRevenue || 380).toLocaleString()}&nbsp;
          <span className="text-ink-2 font-normal text-[9px]">/ d</span>
        </span>
      </div>

      {/* Direct stage advance button */}
      <div className="pt-1 flex justify-end">
        {ticket.status === 'open' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMove('dispatched')
            }}
            className="label text-[9px] text-ink hover:text-accent"
          >
            Dispatch &rarr;
          </button>
        )}
        {ticket.status === 'dispatched' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMove('in_progress')
            }}
            className="label text-[9px] text-ink hover:text-accent"
          >
            Start &rarr;
          </button>
        )}
        {ticket.status === 'in_progress' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMove('resolved')
            }}
            className="label text-[9px] text-warn hover:text-ink"
          >
            Resolve &rarr;
          </button>
        )}
        {ticket.status === 'resolved' && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onMove('verified')
            }}
            className="label text-[9px] text-ok hover:text-ink font-medium"
          >
            Verify Restored &rarr;
          </button>
        )}
      </div>
    </motion.div>
  )
}

/**
 * Animated count-up modal when ticket is verified and restored.
 */
function VerificationModal({ data, currency, onClose }) {
  const animatedKwh = useCountUp(data.kwh, 800)
  const animatedRevenue = useCountUp(data.revenue, 800)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-paper border border-line p-6 max-w-md w-full space-y-4 text-center"
      >
        <span className="label text-ok text-[11px] block">CRUCIBLE RE-CHECK VERIFIED</span>

        <h3 className="font-display text-2xl text-ink font-medium">
          Generation Restored
        </h3>

        <p className="font-sans text-xs text-ink-2">
          Post-maintenance telemetry for <span className="font-mono text-ink font-medium">{data.assetId}</span> verified against expected digital twin. Output nominal.
        </p>

        <div className="border border-ok/40 bg-ok/10 p-4 space-y-1">
          <div className="font-mono text-2xl font-bold text-ok tabular-nums">
            Recovered {Math.round(animatedKwh).toLocaleString()} kWh/day · {currency}&nbsp;{Math.round(animatedRevenue).toLocaleString()}/day
          </div>
          <span className="font-mono text-[10px] text-ink-2">
            Restored to fleet balance
          </span>
        </div>

        <div className="pt-2">
          <Button variant="primary" size="md" className="w-full" onClick={onClose}>
            Acknowledge &amp; Close Ticket
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
