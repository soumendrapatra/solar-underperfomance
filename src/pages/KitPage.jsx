/**
 * /app/_kit — Hidden dev page. Renders every UI component in all variants.
 * Not linked from the nav. Visit manually to review the design system.
 */
import { useState } from 'react'
import {
  Button,
  Badge,
  Card,
  Stat,
  Tabs,
  Drawer,
  Tooltip,
  Table,
  Kbd,
  Skeleton,
  useToast,
} from '@/components/ui'
import { formatKW, formatKWh, formatMWh, formatPct, formatCurrency, formatDuration, formatTimeIST } from '../lib/format.js'

// ── Inline SVG icons used in button demos ────────────────────────────────
function IconDownload() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 1v7M3 6l3 3 3-3M2 10h8" />
    </svg>
  )
}
function IconAlert() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 1L1 10h10L6 1z" />
      <line x1="6" y1="5" x2="6" y2="7.5" />
      <circle cx="6" cy="9" r="0.5" fill="currentColor" />
    </svg>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-b border-line pb-2">
        <span className="label text-ink">{title}</span>
      </div>
      {children}
    </section>
  )
}

// ── Row of items ─────────────────────────────────────────────────────────
function Row({ children, wrap = false }) {
  return (
    <div className={`flex items-center gap-3 ${wrap ? 'flex-wrap' : ''}`}>
      {children}
    </div>
  )
}

// ── Table demo data ───────────────────────────────────────────────────────
const TABLE_COLS = [
  { key: 'id',     label: 'Inverter', sortable: true },
  { key: 'pac',    label: 'Pac (kW)', mono: true, align: 'right', sortable: true },
  { key: 'pr',     label: 'PR',       mono: true, align: 'right', sortable: true },
  { key: 'status', label: 'Status' },
]
const TABLE_ROWS = [
  { id: 'INV-01', pac: '1,248.4', pr: '0.814', status: 'Normal' },
  { id: 'INV-02', pac: '1,102.7', pr: '0.719', status: 'Derated' },
  { id: 'INV-03', pac: '1,251.0', pr: '0.817', status: 'Normal' },
  { id: 'INV-04', pac: '0.0',     pr: '—',     status: 'Tripped' },
  { id: 'INV-05', pac: '1,245.3', pr: '0.812', status: 'Normal' },
]

export default function KitPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loadingBtn, setLoadingBtn] = useState(false)
  const toast = useToast()

  function simulateLoad() {
    setLoadingBtn(true)
    setTimeout(() => setLoadingBtn(false), 2200)
  }

  return (
    <div className="max-w-4xl mx-auto py-8 flex flex-col gap-10">
      {/* Header */}
      <div className="border-b border-line pb-4">
        <h1 className="font-display text-3xl font-medium text-ink">UI Kit</h1>
        <p className="mt-1 font-sans text-sm text-ink-2">
          All components, all variants. Internal review only — not linked from nav.
        </p>
      </div>

      {/* ── Buttons ─────────────────────────────────────────────────────── */}
      <Section title="Button">
        <Row>
          <span className="label w-20 text-ink-2">Primary</span>
          <Button variant="primary" size="md">Export CSV</Button>
          <Button variant="primary" size="sm">Export CSV</Button>
          <Button variant="primary" size="md" icon={<IconDownload />}>Download</Button>
          <Button variant="primary" size="md" loading={loadingBtn} onClick={simulateLoad}>
            Run Analysis
          </Button>
        </Row>
        <Row>
          <span className="label w-20 text-ink-2">Secondary</span>
          <Button variant="secondary" size="md">View Report</Button>
          <Button variant="secondary" size="sm">View Report</Button>
          <Button variant="secondary" size="md" icon={<IconDownload />} iconPosition="right">
            Download
          </Button>
        </Row>
        <Row>
          <span className="label w-20 text-ink-2">Ghost</span>
          <Button variant="ghost" size="md">Cancel</Button>
          <Button variant="ghost" size="sm">Cancel</Button>
          <Button variant="ghost" disabled>Disabled</Button>
        </Row>
        <Row>
          <span className="label w-20 text-ink-2">Danger</span>
          <Button variant="danger" size="md" icon={<IconAlert />}>Clear Data</Button>
          <Button variant="danger" size="sm">Delete</Button>
        </Row>
      </Section>

      {/* ── Badges ──────────────────────────────────────────────────────── */}
      <Section title="Badge">
        <Row wrap>
          {(['critical','high','medium','low','info','ok']).map((v) => (
            <Badge key={v} variant={v}>{v}</Badge>
          ))}
        </Row>
        <Row wrap>
          <Badge variant="critical">String Open Circuit</Badge>
          <Badge variant="high">Inverter Derated</Badge>
          <Badge variant="medium">Soiling Detected</Badge>
          <Badge variant="low">Minor Mismatch</Badge>
          <Badge variant="info">Clipping — Normal</Badge>
          <Badge variant="ok">All Strings Healthy</Badge>
        </Row>
      </Section>

      {/* ── Cards ───────────────────────────────────────────────────────── */}
      <Section title="Card">
        <div className="grid grid-cols-2 gap-4">
          <Card header="Inverter Summary" headerRight={<Badge variant="ok">Healthy</Badge>} figure="01">
            <p className="font-sans text-sm text-ink-2">INV-01 · Bhadla Block C</p>
            <p className="font-mono text-sm mt-1">1,248.4 kW · PR 0.814</p>
          </Card>
          <Card header="Active Fault">
            <p className="font-sans text-sm text-ink-2">String S04 on SCB-02 shows open-circuit current.</p>
          </Card>
          <Card>
            <p className="font-sans text-sm text-ink-2">Card with no header. Plain body content.</p>
          </Card>
          <Card header="Data Range" figure="07" noPadding>
            <div className="px-4 py-3 font-mono text-sm text-ink-2">
              15 Mar 2024 — 15 Mar 2024
            </div>
          </Card>
        </div>
      </Section>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <Section title="Stat">
        <div className="grid grid-cols-4 gap-4">
          <Stat label="Expected Power" value={9842.6} unit="kW" decimals={1} />
          <Stat label="Actual Power"   value={8109.3} unit="kW" decimals={1}
                delta={-0.176} deltaLabel="vs expected" deltaPositiveIsGood={false} />
          <Stat label="Performance Ratio" value={0.814} unit="" decimals={3}
                delta={0.022} deltaLabel="vs 30-day" />
          <Stat label="Revenue Loss" value={14820} unit="INR" decimals={0}
                delta={-0.182} deltaLabel="vs baseline" deltaPositiveIsGood={false} />
        </div>
      </Section>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Section title="Tabs">
        <Tabs
          tabs={[
            { id: 'power',    label: 'Power' },
            { id: 'irradiance', label: 'Irradiance' },
            { id: 'strings',  label: 'Strings' },
            { id: 'thermal',  label: 'Thermal' },
          ]}
        />
      </Section>

      {/* ── Drawer ──────────────────────────────────────────────────────── */}
      <Section title="Drawer">
        <Row>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open Drawer
          </Button>
          <span className="label text-ink-2">
            <Kbd>Esc</Kbd> to close
          </span>
        </Row>
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Work Order — WO-2024-031">
          <div className="flex flex-col gap-4">
            <div>
              <span className="label text-ink-2">Fault</span>
              <p className="font-sans text-sm text-ink mt-1">
                String S04 on combiner SCB-02 (INV-01) is reading zero current while adjacent strings
                show 8.2 A. Likely open-circuit condition — check for blown string fuse or damaged
                connector at row 4, module 12.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Energy Loss" value={182.4} unit="kWh" decimals={1} />
              <Stat label="Revenue Loss" value={452} unit="INR" decimals={0} />
            </div>
            <Badge variant="high">High Priority</Badge>
            <Button variant="primary" size="sm">Assign to Field Team</Button>
          </div>
        </Drawer>
      </Section>

      {/* ── Tooltip ─────────────────────────────────────────────────────── */}
      <Section title="Tooltip">
        <Row>
          <Tooltip content="POA irradiance sensor, calibrated 2024-01">
            <span className="font-mono text-sm underline decoration-dotted cursor-default">
              GHI Sensor
            </span>
          </Tooltip>
          <Tooltip content="INV-04 · SCB-07 · String S12" side="right">
            <Badge variant="critical">String Open Circuit</Badge>
          </Tooltip>
          <Tooltip content="Last updated 14:32 IST" side="bottom">
            <span className="label text-ink-2 cursor-default">PR 0.814</span>
          </Tooltip>
        </Row>
      </Section>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <Section title="Table">
        <Card noPadding>
          <Table
            columns={TABLE_COLS}
            rows={TABLE_ROWS}
            keyProp="id"
            onRowClick={(row) => toast(`Selected ${row.id}`)}
          />
        </Card>
      </Section>

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      <Section title="Toast">
        <Row wrap>
          <Button variant="secondary" size="sm" onClick={() => toast('SCADA data loaded — 288 intervals')}>
            Default toast
          </Button>
          <Button variant="secondary" size="sm" onClick={() => toast('Diagnosis complete — 3 faults identified')}>
            Long message
          </Button>
        </Row>
      </Section>

      {/* ── Kbd ─────────────────────────────────────────────────────────── */}
      <Section title="Kbd">
        <Row>
          <Kbd>Esc</Kbd>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
          <Kbd>Enter</Kbd>
          <Kbd>Tab</Kbd>
          <Kbd>Shift</Kbd>
          <Kbd>?</Kbd>
        </Row>
        <Row>
          <span className="font-sans text-sm text-ink-2">
            Press <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> to open command palette
          </span>
        </Row>
      </Section>

      {/* ── Skeleton ────────────────────────────────────────────────────── */}
      <Section title="Skeleton">
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-32 w-full" />
      </Section>

      {/* ── Format utilities ────────────────────────────────────────────── */}
      <Section title="Format utilities">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 font-mono text-sm">
          {[
            ['formatKW(9842600)', formatKW(9842600)],
            ['formatKWh(1840300)', formatKWh(1840300)],
            ['formatMWh(9842600)', formatMWh(9842600)],
            ['formatPct(-0.182)', formatPct(-0.182)],
            ['formatPct(0.035)', formatPct(0.035)],
            ['formatCurrency(14820)', formatCurrency(14820)],
            ['formatCurrency(14820, true)', formatCurrency(14820, true)],
            ['formatDuration(8160)', formatDuration(8160)],
            ['formatDuration(225)', formatDuration(225)],
            ['formatTimeIST("2024-03-15T09:02:00+05:30")', formatTimeIST('2024-03-15T09:02:00+05:30')],
          ].map(([call, result]) => (
            <div key={call} className="contents">
              <span className="text-ink-2 text-[11px] py-0.5">{call}</span>
              <span className="text-ink text-[12px] py-0.5">{result}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Color palette ────────────────────────────────────────────────── */}
      <Section title="Palette">
        <div className="flex gap-2 flex-wrap">
          {[
            ['paper',   '#F3F0E8'],
            ['paper-2', '#EAE6DB'],
            ['ink',     '#16150F'],
            ['ink-2',   '#4A473D'],
            ['line',    '#D6D1C4'],
            ['accent',  '#D9790B'],
            ['fault',   '#B4441E'],
            ['warn',    '#B98A12'],
            ['ok',      '#4F6B2A'],
            ['info',    '#2F5D7C'],
          ].map(([name, hex]) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <div
                className="w-10 h-10 border border-line"
                style={{ backgroundColor: hex }}
              />
              <span className="font-mono text-[9px] text-ink-2 uppercase tracking-wider">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Bottom padding */}
      <div className="h-16" />
    </div>
  )
}
