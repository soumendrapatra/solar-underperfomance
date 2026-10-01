import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { to: '/app',             label: 'Portfolio',    end: true },
  { to: '/app/work-orders', label: 'Work Orders' },
  { to: '/app/lab',         label: 'Lab' },
  { to: '/app/data-health', label: 'Data Health' },
  { to: '/app/model',       label: 'Model' },
  { to: '/app/ingest',      label: 'Ingest' },
  { to: '/app/settings',    label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="w-52 shrink-0 border-r border-line bg-paper-2 flex flex-col py-5 px-3 gap-1">
      <div className="px-2 mb-5">
        <span className="font-display text-[17px] font-medium text-ink tracking-tight">Kiran RCA</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'label px-2 py-1.5 rounded-sm transition-colors duration-150',
                isActive
                  ? 'bg-accent text-paper'
                  : 'text-ink-2 hover:bg-line hover:text-ink'
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

