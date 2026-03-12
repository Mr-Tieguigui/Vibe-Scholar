import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchProjects, importProject, deleteProject, fetchReportList, fetchTodaySummary, fetchRecentEvents, type ProjectSummary } from '../api'
import { Link, useNavigate } from 'react-router-dom'
import ProgressBar from '../components/ProgressBar'
import { SkeletonCard } from '../components/Skeleton'
import { AlertTriangle, Clock, Zap, Plus, X, Loader2, BookOpen, Trash2, FileBarChart } from 'lucide-react'
import { useState, useRef, useEffect, useMemo } from 'react'

type SortKey = 'priority' | 'last_updated' | 'rag' | 'vc_progress'

export default function HomePage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: projects, isLoading } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const { data: reportList } = useQuery({ queryKey: ['reportList'], queryFn: fetchReportList })
  const { data: todaySummary } = useQuery({ queryKey: ['todaySummary'], queryFn: fetchTodaySummary, refetchInterval: 30000 })
  const { data: recentEvents } = useQuery({ queryKey: ['recentEvents'], queryFn: () => fetchRecentEvents(10), refetchInterval: 30000 })
  const [sort, setSort] = useState<SortKey>('priority')
  const [filter, setFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null)

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const handleDeleteRequest = (id: string) => {
    const proj = projects?.find(p => p.id === id)
    if (proj) setDeleteTarget(proj)
  }

  const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
  const ragOrder: Record<string, number> = { red: 0, amber: 1, green: 2 }

  const sorted = [...(projects ?? [])].filter((p) => {
    if (!filter) return true
    return p.pillar.toLowerCase().includes(filter.toLowerCase()) || p.tags.some((t) => t.toLowerCase().includes(filter.toLowerCase()))
  }).sort((a, b) => {
    if (sort === 'priority') return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
    if (sort === 'rag') return (ragOrder[a.rag] ?? 9) - (ragOrder[b.rag] ?? 9)
    if (sort === 'vc_progress') return b.vc_progress - a.vc_progress
    return (b.last_activity ?? '').localeCompare(a.last_activity ?? '')
  })

  return (
    <div>
      {/* Header — uses UI font (same as sidebar), with panel background */}
      <div className="lp-panel px-5 py-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-bold text-slate-900 tracking-tight">VibeScholar Dashboard</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {projects?.length ?? 0} research directions &middot; Track execution, literature &amp; deliverables
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-[12px] px-3 py-1.5 rounded-[8px] border border-slate-200 bg-white"
          >
            <option value="priority">Sort: Priority</option>
            <option value="last_updated">Sort: Last Updated</option>
            <option value="rag">Sort: RAG</option>
            <option value="vc_progress">Sort: VC Progress</option>
          </select>
          <input
            placeholder="Filter by tag..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-[12px] px-3 py-1.5 rounded-[8px] border border-slate-200 bg-white w-40"
          />
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary"
          >
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      {showAdd && (
        <QuickAddModal
          existingPillars={[...new Set((projects ?? []).map(p => p.pillar).filter(Boolean))].sort()}
          onClose={() => setShowAdd(false)}
          onCreated={(pid) => {
            setShowAdd(false)
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            navigate(`/projects/${pid}`)
          }}
        />
      )}

      {/* ═══ Dashboard Overview — single container, 1:2:1 with vertical dividers ═══ */}
      <div className="lp-panel p-0 mb-7 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 rounded-full bg-indigo-500" />
            <h2 className="text-[12px] font-bold text-slate-800 uppercase tracking-wider">Dashboard Overview</h2>
          </div>
        </div>
        <div className="flex min-h-[180px]">
          {/* Left: Today Summary (1fr) */}
          <div className="flex-1 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-emerald-600" />
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Today</span>
              {todaySummary?.date && <span className="text-[9px] text-slate-400 font-mono">{todaySummary.date}</span>}
            </div>
            {todaySummary && todaySummary.total > 0 ? (
              <div className="space-y-3">
                <div className="text-3xl font-black text-slate-900 tracking-tight">{todaySummary.total} <span className="text-[11px] font-medium text-slate-400">events</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(todaySummary.by_kind).map(([kind, count]) => (
                    <span key={kind} className="lp-chip lp-chip-teal">
                      {kind}: {count}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-slate-400 italic mt-1">No activity yet today</p>
            )}
          </div>

          {/* Divider 1 */}
          <div className="lp-divider-v" />

          {/* Center: Recent Activity with auto-scroll (2fr) */}
          <div className="flex-[2] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-blue-600" />
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Recent Activity</span>
            </div>
            <ActivityTicker events={recentEvents ?? []} />
          </div>

          {/* Divider 2 */}
          <div className="lp-divider-v" />

          {/* Right: Reports & Quick Actions (1fr) */}
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileBarChart size={14} className="text-indigo-600" />
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Reports</span>
              </div>
              <Link to="/reports" className="text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold">All →</Link>
            </div>
            <div className="space-y-1.5">
              {reportList?.daily?.slice(0, 2).map((d) => (
                <Link key={d} to="/reports" className="flex items-center gap-2 text-[11px] text-slate-600 hover:text-indigo-600 bg-slate-50/80 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-indigo-100">
                  <span className="lp-chip lp-chip-teal">D</span>
                  {d}
                </Link>
              ))}
              {reportList?.weekly?.slice(0, 2).map((w) => (
                <Link key={w} to="/reports" className="flex items-center gap-2 text-[11px] text-slate-600 hover:text-indigo-600 bg-slate-50/80 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-indigo-100">
                  <span className="lp-chip lp-chip-indigo">W</span>
                  {w}
                </Link>
              ))}
              {!reportList?.daily?.length && !reportList?.weekly?.length && (
                <p className="text-[12px] text-slate-400 italic">No reports generated yet</p>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <Link to="/reports" className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">
                <FileBarChart size={11} /> Generate Report →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Projects ═══ */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-5 rounded-full bg-slate-400" />
        <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Projects</h2>
        <span className="text-[11px] text-slate-400 font-mono ml-1">{sorted.length}</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sorted.map((p) => (
            <ProjectCard key={p.id} project={p} onDelete={handleDeleteRequest} />
          ))}
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="lp-panel !rounded-[16px] shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-100 rounded-full">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Delete Project</h3>
                <p className="text-[12px] text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-[13px] text-slate-700 mb-1">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
            </p>
            <p className="text-[12px] text-slate-400 mb-5">
              All project data including execution steps, literature, timeline, and artifacts will be permanently removed.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary text-[13px] py-2 px-4"
                disabled={deleteMut.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteTarget.id)}
                disabled={deleteMut.isPending}
                className="flex items-center gap-1.5 text-[13px] font-medium py-2 px-4 rounded-[10px] bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleteMut.isPending ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Activity Ticker: stable setInterval scrollTop auto-scroll + day separators ── */
function ActivityTicker({ events }: { events: Array<{ ts?: string; kind: string; summary: string; project_id?: string }> }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const itemsWithSeparators = useMemo(() => {
    if (!events.length) return []
    const result: Array<{ type: 'event'; ev: typeof events[0] } | { type: 'separator'; date: string }> = []
    let lastDay = ''
    for (const ev of events) {
      const day = ev.ts?.slice(0, 10) || ''
      if (day && day !== lastDay) {
        result.push({ type: 'separator', date: day })
        lastDay = day
      }
      result.push({ type: 'event', ev })
    }
    return result
  }, [events])

  // Stable setInterval: increment scrollTop by 1px every 40ms (~25fps, no jitter)
  useEffect(() => {
    if (reducedMotion || events.length === 0) return
    const el = scrollRef.current
    if (!el) return
    const id = setInterval(() => {
      if (pausedRef.current) return
      el.scrollTop += 1
      if (el.scrollTop >= el.scrollHeight - el.clientHeight) {
        el.scrollTop = 0
      }
    }, 40)
    return () => clearInterval(id)
  }, [events, reducedMotion])

  if (events.length === 0) {
    return <p className="text-[12px] text-slate-400 italic mt-1">No events recorded yet</p>
  }

  const kindStyle = (kind: string) => {
    switch (kind) {
      case 'step': return 'lp-chip lp-chip-indigo'
      case 'log': return 'lp-chip lp-chip-teal'
      case 'artifact': return 'lp-chip lp-chip-purple'
      case 'literature': return 'lp-chip lp-chip-indigo'
      case 'designspec': return 'lp-chip lp-chip-purple'
      case 'timeline': return 'lp-chip lp-chip-teal'
      default: return 'lp-chip lp-chip-slate'
    }
  }

  return (
    <div
      ref={scrollRef}
      className={`max-h-[130px] lp-scroll ${reducedMotion ? 'overflow-y-auto' : 'overflow-hidden'}`}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
    >
      <div className="space-y-1">
        {itemsWithSeparators.map((item, i) => {
          if (item.type === 'separator') {
            return (
              <div key={`sep-${i}`} className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[9px] font-mono text-slate-400 shrink-0">{item.date}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            )
          }
          const ev = item.ev
          return (
            <div key={`ev-${i}`} className="flex items-start gap-2 text-[11px] py-0.5">
              <span className="text-slate-400 font-mono shrink-0 w-11 text-[10px]">{ev.ts?.slice(11, 16) || ''}</span>
              <span className={`shrink-0 ${kindStyle(ev.kind)}`}>{ev.kind}</span>
              <span className="text-slate-600 line-clamp-1">{ev.summary}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProjectCard({ project: p, onDelete }: { project: ProjectSummary; onDelete: (id: string) => void }) {
  return (
    <Link
      to={`/projects/${p.id}`}
      className="relative block group/card overflow-hidden rounded-[14px] bg-gradient-to-br from-white via-slate-50/50 to-white border border-slate-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Top accent bar */}
      <div className={`h-[3px] w-full ${p.rag === 'red' ? 'bg-gradient-to-r from-red-400 to-red-500' :
        p.rag === 'amber' ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
          'bg-gradient-to-r from-indigo-400 to-emerald-400'
        }`} />

      <div className="p-4">
        {/* Title row: Name + Pillar + Status */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-[14px] text-slate-900 leading-snug group-hover/card:text-indigo-700 transition-colors flex items-center gap-2 min-w-0">
            <span className="truncate">{p.name}</span>
            {p.pillar && <span className="lp-chip lp-chip-teal shrink-0">{p.pillar.split(':')[0]}</span>}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`lp-chip ${p.priority === 'P0' ? 'lp-chip-purple' :
              p.priority === 'P1' ? 'lp-chip-indigo' : 'lp-chip-slate'
              }`}>{p.priority}</span>
            <RagBadge rag={p.rag} />
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(p.id) }}
              className="opacity-0 group-hover/card:opacity-100 transition-opacity p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
              title="Delete project"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Description (muted one-liner) */}
        {p.definition && (
          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-3">{p.definition}</p>
        )}

        {/* Metrics row */}
        <div className="flex items-center gap-4 text-[10px] text-slate-500 mb-3">
          <span className="flex items-center gap-1">
            <BookOpen size={11} className="text-slate-400" />
            <span className="font-mono font-semibold">{p.literature_count}</span> papers
          </span>
          {p.blockers_count > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertTriangle size={11} />
              <span className="font-mono font-semibold">{p.blockers_count}</span> blockers
            </span>
          )}
          {p.overdue_count > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <Clock size={11} />
              <span className="font-mono font-semibold">{p.overdue_count}</span> overdue
            </span>
          )}
          {p.last_activity && (
            <span className="flex items-center gap-1 ml-auto font-mono text-slate-400">
              <Clock size={10} />
              {new Date(p.last_activity).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>

        {/* Progress: two separate labeled bars */}
        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-slate-600 font-medium flex items-center gap-1">
                <Zap size={10} className="text-blue-500" /> Vibe Coding
              </span>
              <span className="font-mono font-bold text-slate-700">{p.vc_progress}%</span>
            </div>
            <ProgressBar value={p.vc_progress} />
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-slate-600 font-medium flex items-center gap-1">
                <BookOpen size={10} className="text-purple-500" /> Vibe Research
              </span>
              <span className="font-mono font-bold text-slate-700">{p.vr_progress}%</span>
            </div>
            <ProgressBar value={p.vr_progress} />
          </div>
        </div>
      </div>

      {/* Tags row */}
      {(p.tags.length > 0 || p.literature_tags?.length) && (
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/30 flex items-center gap-1.5 flex-wrap">
          {p.tags.map((t) => (
            <span key={t} className="lp-chip lp-chip-slate">{t}</span>
          ))}
          {p.literature_tags?.slice(0, 3).map((t) => (
            <span key={t} className="lp-chip lp-chip-purple">{t}</span>
          ))}
        </div>
      )}
    </Link>
  )
}

function RagBadge({ rag }: { rag: string }) {
  const cls =
    rag === 'red' ? 'bg-red-100 text-red-700 border-red-200' :
      rag === 'amber' ? 'bg-amber-100 text-amber-700 border-amber-200' :
        'bg-emerald-100 text-emerald-700 border-emerald-200'
  return (
    <span className={`lp-chip ${cls}`}>
      {rag.toUpperCase()}
    </span>
  )
}

function QuickAddModal({ existingPillars, onClose, onCreated }: { existingPillars: string[]; onClose: () => void; onCreated: (pid: string) => void }) {
  const [mode, setMode] = useState<'form' | 'yaml'>('form')
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [definition, setDefinition] = useState('')
  const [pillar, setPillar] = useState('')
  const [customPillar, setCustomPillar] = useState(false)
  const [priority, setPriority] = useState('P2')
  const [tags, setTags] = useState('')
  const [yamlText, setYamlText] = useState(YAML_TEMPLATE)
  const [error, setError] = useState('')

  const addMut = useMutation({
    mutationFn: (template: Record<string, unknown>) => importProject(template),
    onSuccess: (d) => onCreated(d.project_id),
    onError: (e: Error) => setError(e.message || 'Import failed'),
  })

  const handleFormSubmit = () => {
    if (!id || !name) { setError('ID and Name are required'); return }
    setError('')
    addMut.mutate({
      id: id.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      name,
      name_en: nameEn,
      definition,
      pillar,
      priority,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })
  }

  const handleYamlSubmit = () => {
    setError('')
    try {
      const parsed = JSON.parse(yamlText)
      if (!parsed.id || !parsed.name) { setError('Template must have id and name'); return }
      addMut.mutate(parsed)
    } catch {
      setError('Invalid JSON. Use the JSON template format shown.')
    }
  }

  const inputCls = "w-full text-[12px] px-3 py-2 rounded-[8px] border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="lp-panel w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-2xl !rounded-[16px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">New Project</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Create a new research direction</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
        </div>

        <div className="p-5">
          {/* Mode toggle */}
          <div className="flex lp-panel p-0.5 w-fit mb-4">
            <button
              onClick={() => setMode('form')}
              className={`px-3.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-colors ${mode === 'form' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >Simple Form</button>
            <button
              onClick={() => setMode('yaml')}
              className={`px-3.5 py-1.5 text-[12px] font-medium rounded-[8px] transition-colors ${mode === 'yaml' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >JSON Template</button>
          </div>

          {error && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-[8px] text-[12px] text-red-700">{error}</div>
          )}

          {mode === 'form' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Project ID *</label>
                  <input value={id} onChange={e => setId(e.target.value)} placeholder="my-project" className={inputCls} />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} className={inputCls}>
                    <option value="P0">P0 — Critical</option>
                    <option value="P1">P1 — High</option>
                    <option value="P2">P2 — Medium</option>
                    <option value="P3">P3 — Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Project Name" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">English Name</label>
                <input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="English Name" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Definition</label>
                <textarea value={definition} onChange={e => setDefinition(e.target.value)} placeholder="Brief project definition..." rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pillar</label>
                  {!customPillar && existingPillars.length > 0 ? (
                    <div className="space-y-1.5">
                      <select
                        value={pillar}
                        onChange={e => {
                          if (e.target.value === '__custom__') { setCustomPillar(true); setPillar('') }
                          else setPillar(e.target.value)
                        }}
                        className={inputCls}
                      >
                        <option value="">Select pillar...</option>
                        {existingPillars.map(p => <option key={p} value={p}>{p}</option>)}
                        <option value="__custom__">+ New pillar</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input value={pillar} onChange={e => setPillar(e.target.value)} placeholder="P1: Category" className={`${inputCls} flex-1`} />
                      {existingPillars.length > 0 && (
                        <button onClick={() => { setCustomPillar(false); setPillar('') }} className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium whitespace-nowrap">List</button>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tags (comma-sep)</label>
                  <input value={tags} onChange={e => setTags(e.target.value)} placeholder="safety, audit, ml" className={inputCls} />
                </div>
              </div>
              <button
                onClick={handleFormSubmit}
                disabled={addMut.isPending}
                className="w-full btn-primary justify-center py-2.5"
              >
                {addMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {addMut.isPending ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={yamlText}
                onChange={e => setYamlText(e.target.value)}
                rows={14}
                className="w-full text-[11px] font-mono px-3 py-2 rounded-[10px] border border-slate-200 resize-none bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                onClick={handleYamlSubmit}
                disabled={addMut.isPending}
                className="w-full btn-primary justify-center py-2.5"
              >
                {addMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {addMut.isPending ? 'Importing...' : 'Import from Template'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const YAML_TEMPLATE = JSON.stringify({
  id: "new-project",
  name: "New Research Project",
  name_en: "New Research Project",
  definition: "Brief project definition here",
  pillar: "P1: Category",
  tags: ["tag1", "tag2"],
  priority: "P2",
  overview: {
    definition: "Detailed project definition...",
    motivation: "Why this project matters...",
    scope: "What is in/out of scope...",
    concepts: ["Concept A", "Concept B"],
    pipeline: ["Step 1: Data collection", "Step 2: Processing"],
    milestones: [
      { id: "M1", title: "Milestone 1", week: "W1-2", acceptance: "Criteria 1" },
      { id: "M2", title: "Milestone 2", week: "W3-4", acceptance: "Criteria 2" },
    ],
    deliverables: ["Paper draft", "Code repository", "Demo"],
  },
}, null, 2)
