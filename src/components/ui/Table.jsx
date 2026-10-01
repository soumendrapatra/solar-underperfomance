import { useState, useCallback } from 'react'
import { cn } from '../../lib/cn.js'

// Inline SVG carets — 1.5px stroke, no icon library
function SortCaret({ direction }) {
  return (
    <svg
      width="8"
      height="10"
      viewBox="0 0 8 10"
      fill="none"
      className="shrink-0"
      aria-hidden="true"
    >
      {/* Up caret */}
      <path
        d="M4 1L7 4H1L4 1Z"
        fill={direction === 'asc' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1"
      />
      {/* Down caret */}
      <path
        d="M4 9L1 6H7L4 9Z"
        fill={direction === 'desc' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  )
}

/**
 * @typedef {{ key: string; label: string; mono?: boolean; align?: 'left'|'right'; sortable?: boolean; width?: string }} ColDef
 *
 * @param {{
 *   columns: ColDef[]
 *   rows: Record<string, any>[]
 *   keyProp?: string           - Row key field, default 'id'
 *   onRowClick?: (row: any) => void
 *   className?: string
 *   emptyMessage?: string
 * }} props
 */
export function Table({ columns, rows, keyProp = 'id', onRowClick, className, emptyMessage = 'No data.' }) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' })

  const toggleSort = useCallback((key) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    )
  }, [])

  const sorted = [...rows].sort((a, b) => {
    if (!sort.key) return 0
    const av = a[sort.key]
    const bv = b[sort.key]
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return sort.dir === 'asc' ? cmp : -cmp
  })

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={cn(
                  'label py-2 px-3 font-normal text-ink-2 whitespace-nowrap select-none',
                  col.align === 'right' ? 'text-right' : 'text-left',
                  col.sortable && 'cursor-pointer hover:text-ink'
                )}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    <SortCaret direction={sort.key === col.key ? sort.dir : null} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-6 text-center label text-ink-2"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={row[keyProp] ?? JSON.stringify(row)}
                className={cn(
                  'border-b border-line h-9 transition-colors duration-100',
                  onRowClick
                    ? 'cursor-pointer hover:bg-paper-2'
                    : 'hover:bg-paper-2'
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3 py-0 leading-none',
                      col.mono ? 'font-mono text-[13px] tabular-nums' : 'font-sans text-[13px]',
                      col.align === 'right' ? 'text-right' : 'text-left'
                    )}
                  >
                    {row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
