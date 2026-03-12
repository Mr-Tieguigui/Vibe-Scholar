import { Outlet, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchProjects, type ProjectSummary } from '../api'
import {
  Home, FolderKanban, BookOpen, FileBarChart, Settings,
  Search, Clock, Sun, Moon,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { useTheme } from './ThemeProvider'


const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/literature', icon: BookOpen, label: 'Literature' },
  { to: '/reports', icon: FileBarChart, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="7" fill="#4f46e5" />
        <path d="M7 14h2l2-4 3 8 2.5-6 1.5 3h3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="14" cy="14" r="9" stroke="white" strokeWidth="1.2" strokeOpacity="0.25" />
      </svg>
      <div>
        <h1 className="text-[15px] font-extrabold text-slate-900 tracking-tight leading-none">
          <span>Vibe</span><span className="text-indigo-500">Scholar</span>
        </h1>
        <p className="text-[10px] text-slate-400 font-medium tracking-wide leading-none mt-0.5">
          Human-in-the-Loop Vibe Scholar Research
        </p>
      </div>
    </div>
  )
}

export default function Layout() {
  const [searchOpen, setSearchOpen] = useState(false)
  const { theme, toggle: toggleTheme } = useTheme()
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })

  const pillarGroups = useMemo(() => {
    if (!projects) return []
    const groups: Record<string, ProjectSummary[]> = {}
    for (const p of projects) {
      const key = p.pillar || 'Uncategorized'
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [projects])

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[272px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
        <div className="px-5 py-4 border-b border-slate-100">
          <BrandLogo />
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-5 py-2 text-[13px] transition-colors ${isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold border-r-[3px] border-indigo-500'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <item.icon size={15} className="shrink-0" />
              {item.label}
            </NavLink>
          ))}

          <div className="mt-4 mb-1 px-5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projects</span>
            <span className="text-[10px] font-mono text-slate-400">{projects?.length ?? 0}</span>
          </div>

          {pillarGroups.map(([pillar, items]) => (
            <div key={pillar}>
              <div className="px-5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
                {pillar}
              </div>
              {items.map((p) => (
                <NavLink
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-5 py-[7px] text-[12.5px] transition-colors group ${isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold border-r-[3px] border-indigo-500'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <FolderKanban size={13} className="shrink-0 text-slate-400 group-hover:text-slate-600" />
                  <span className="truncate">{p.name}</span>
                  <RagDot rag={p.rag} />
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>{projects?.length ?? 0} projects</span>
            <span className="flex items-center gap-0.5 text-slate-400">
              <Clock size={11} />
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            {searchOpen ? (
              <input
                autoFocus
                className="text-sm px-3 py-1.5 rounded-[10px] border border-slate-200 w-80 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                placeholder="Search projects, papers, logs..."
                onBlur={() => setSearchOpen(false)}
              />
            ) : (
              <button
                onClick={() => setSearchOpen(true)}
                className="flex items-center gap-2 text-[13px] text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-[10px] border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <Search size={14} />
                Search...
                <kbd className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 ml-4 font-mono">/</kbd>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-[13px] text-slate-500">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-700"
              title={theme === 'dark' ? 'Switch to Day mode' : 'Switch to Night mode'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span className="text-[11px] font-medium">{theme === 'dark' ? 'Day' : 'Night'}</span>
            </button>
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" />
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6 lp-page-bg lp-scroll">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function RagDot({ rag }: { rag: string }) {
  const color =
    rag === 'red' ? 'bg-red-500' : rag === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'
  return <span className={`w-2 h-2 rounded-full ${color} shrink-0 ml-auto`} />
}
