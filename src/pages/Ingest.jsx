import { useState, useRef } from 'react'
import Papa from 'papaparse'
import { PageHeader } from '../components/layout/PageHeader.jsx'
import { Card, Badge, Button, useToast } from '@/components/ui'
export default function Ingest() {
  const pushToast = useToast()
  const fileInputRef = useRef(null)

  const [parsing, setParsing] = useState(false)
  const [csvData, setCsvData] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFileUpload = (file) => {
    if (!file) return
    setParsing(true)
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsing(false)
        setCsvData({
          filename: file.name,
          rowCount: results.data.length,
          fields: results.meta.fields || [],
          rows: results.data.slice(0, 10),
        })
        pushToast(`Parsed ${results.data.length.toLocaleString()} SCADA intervals from ${file.name}.`)
      },
      error: (err) => {
        setParsing(false)
        console.error('[Ingest] CSV parse error:', err)
        pushToast('Error parsing CSV file.')
      },
    })
  }

  // Generate and download a sample 7-day CSV for Bhadla
  const handleDownloadSampleCsv = () => {
    const rows = []
    const baseDate = new Date('2026-06-15T06:00:00+05:30')
    for (let i = 0; i < 288; i++) {
      const t = new Date(baseDate.getTime() + i * 5 * 60000)
      const hour = t.getHours() + t.getMinutes() / 60
      const isDay = hour >= 6.0 && hour <= 18.5
      const poa = isDay ? Math.round(920 * Math.sin(((hour - 6.0) / 12.5) * Math.PI)) : 0
      const tamb = isDay ? Math.round((32 + (hour - 6) * 1.1) * 10) / 10 : 28.5
      const pac = isDay ? Math.round(poa * 10.4) : 0
      const heatsink = isDay ? Math.round(45 + (pac / 10000) * 32) : 32
      rows.push({
        timestamp: t.toISOString(),
        poa_w_m2: poa,
        t_amb_c: tamb,
        pac_kw: pac,
        heatsink_temp_c: heatsink,
        string_01_a: isDay ? 12.8 : 0,
        string_02_a: isDay ? 12.7 : 0,
      })
    }

    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'bhadla_sample_scada_export.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    pushToast('Sample Bhadla SCADA CSV generated and downloaded.')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Telemetry Pipeline · PapaParse Integration"
        title="SCADA Data Ingestion"
        description="Ingest plant SCADA telemetry, weather station CSV files, or combiner box string monitor exports into the Kiran diagnostic crucible."
      >
        <Button variant="secondary" size="md" onClick={handleDownloadSampleCsv}>
          Download Sample CSV
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Zone */}
        <div className="lg:col-span-1 space-y-4">
          <Card figure="01" header="Upload Telemetry CSV File">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                if (e.dataTransfer.files?.[0]) {
                  handleFileUpload(e.dataTransfer.files[0])
                }
              }}
              className={cn(
                'border-2 border-dashed p-8 text-center flex flex-col items-center justify-center space-y-3 cursor-pointer transition-colors',
                dragActive ? 'border-accent bg-accent/5' : 'border-line hover:border-ink/50 bg-paper-2/40'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0])
                }}
              />
              <div className="w-10 h-10 border border-line flex items-center justify-center font-mono text-xs text-ink-2">
                CSV
              </div>
              <div className="space-y-1">
                <span className="font-mono text-xs text-ink font-medium block">
                  {parsing ? 'Parsing telemetry...' : 'Drop SCADA export or browse'}
                </span>
                <span className="font-sans text-[11px] text-ink-2 block">
                  Accepts 5-minute or 1-minute solar SCADA series
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-line space-y-2 font-mono text-xs">
              <span className="label text-ink-2 text-[10px] block">EXPECTED COLUMN CHANNELS</span>
              <ul className="space-y-1 text-ink-2 text-[11px]">
                <li>&bull; <span className="text-ink">timestamp</span> (ISO 8601 or IST)</li>
                <li>&bull; <span className="text-ink">poa_w_m2</span> (Plane of Array Irradiance)</li>
                <li>&bull; <span className="text-ink">t_amb_c</span> (Ambient Air Temperature)</li>
                <li>&bull; <span className="text-ink">pac_kw</span> (Inverter AC Active Power)</li>
                <li>&bull; <span className="text-ink">heatsink_temp_c</span> (Inverter Temperature)</li>
                <li>&bull; <span className="text-ink">string_xx_a</span> (Combiner Box Currents)</li>
              </ul>
            </div>
          </Card>
        </div>

        {/* Ingested Preview & Summary */}
        <div className="lg:col-span-2 space-y-4">
          <Card figure="02" header="Ingested Telemetry Stream Preview">
            {csvData ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-paper-2 border border-line">
                  <div>
                    <span className="text-ink-2 text-[10px] block">ACTIVE FILE</span>
                    <span className="text-ink font-medium">{csvData.filename}</span>
                  </div>
                  <div>
                    <span className="text-ink-2 text-[10px] block">SAMPLE INTERVALS</span>
                    <span className="text-ink font-medium tabular-nums">{csvData.rowCount.toLocaleString()} rows</span>
                  </div>
                  <div>
                    <span className="text-ink-2 text-[10px] block">CHANNELS DETECTED</span>
                    <span className="text-ok font-medium tabular-nums">{csvData.fields.length} channels</span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-line">
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="bg-paper-2 border-b border-line">
                        {csvData.fields.map((f) => (
                          <th key={f} className="py-2 px-2.5 label text-ink-2 font-normal truncate max-w-[130px]">
                            {f}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-line/60 hover:bg-paper-2/40">
                          {csvData.fields.map((f) => (
                            <td key={f} className="py-1.5 px-2.5 text-ink tabular-nums truncate max-w-[130px]">
                              {row[f] != null ? String(row[f]) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      pushToast('Loaded into active plant workspace. Running diagnostic crucible.')
                    }}
                  >
                    Run Full Diagnostic Crucible &rarr;
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center space-y-2 font-mono text-xs text-ink-2">
                <div>No external SCADA telemetry uploaded yet.</div>
                <div className="text-[11px]">
                  Click &quot;Download Sample CSV&quot; above to inspect the format or drop your own file.
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
