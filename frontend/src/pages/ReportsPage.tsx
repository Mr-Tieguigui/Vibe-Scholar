import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  generateDaily, generateWeekly, fetchReportList,
  fetchDailyReport, fetchWeeklyReport,
  type ReportResult, type ReportDetail, type ActivityEvent, type ActivitySummary,
} from '../api'
import { useState, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { FileText, Calendar, Download, Loader2, Clock, FileBarChart, RefreshCw, CheckCircle2, AlertTriangle, ArrowUpDown, BarChart3 } from 'lucide-react'

type ReportTab = 'daily' | 'weekly'
type ViewMode = 'table' | 'markdown'

interface LoadedReport {
  content: string;
  label: string;
  summary?: ActivitySummary;
  events?: ActivityEvent[];
}

export default function ReportsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<ReportTab>('daily')
  const [report, setReport] = useState<LoadedReport | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const { data: reportList } = useQuery({
    queryKey: ['reportList'],
    queryFn: fetchReportList,
  })

  const dailyMut = useMutation({
    mutationFn: () => generateDaily(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reportList'] })
      showToast(`Daily report for ${date} generated`, 'ok')
      loadReport('daily', date)
    },
    onError: () => showToast('Failed to generate daily report', 'err'),
  })

  const weeklyMut = useMutation({
    mutationFn: () => generateWeekly(),
    onSuccess: (result: ReportResult) => {
      const label = result.path.split('/').pop()?.replace('.md', '') ?? 'latest'
      queryClient.invalidateQueries({ queryKey: ['reportList'] })
      showToast(`Weekly report ${label} generated`, 'ok')
      loadReport('weekly', label)
    },
    onError: () => showToast('Failed to generate weekly report', 'err'),
  })

  const loadReport = async (type: 'daily' | 'weekly', key: string) => {
    try {
      const data: ReportDetail = type === 'daily'
        ? await fetchDailyReport(key)
        : await fetchWeeklyReport(key)
      const label = type === 'daily' ? `Daily — ${key}` : `Weekly — ${key}`
      setReport({ content: data.content, label, summary: data.summary, events: data.events })
    } catch {
      setReport({ content: '_Failed to load report._', label: key })
    }
  }

  const exportMd = () => {
    if (!report) return
    const blob = new Blob([report.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${report.label.replace(/\s/g, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const anyPending = dailyMut.isPending || weeklyMut.isPending
  const dailyList = reportList?.daily ?? []
  const weeklyList = reportList?.weekly ?? []
  const currentList = tab === 'daily' ? dailyList : weeklyList

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-[10px] text-[13px] font-medium shadow-lg ${toast.type === 'ok'
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
          {toast.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Header — consistent lp-panel */}
      <div className="lp-panel px-5 py-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-bold text-slate-900 tracking-tight">Reports</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Generate and browse daily / weekly portfolio reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="lp-chip lp-chip-teal">{dailyList.length} daily</span>
          <span className="lp-chip lp-chip-indigo">{weeklyList.length} weekly</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Left column: controls + history */}
        <div className="space-y-4">
          {/* Tab toggle */}
          <div className="flex lp-panel p-0.5">
            <button
              onClick={() => setTab('daily')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-[10px] transition-colors ${tab === 'daily' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Calendar size={12} /> Daily
            </button>
            <button
              onClick={() => setTab('weekly')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-[10px] transition-colors ${tab === 'weekly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <FileBarChart size={12} /> Weekly
            </button>
          </div>

          {/* Generate card */}
          <div className="lp-panel p-4">
            <h3 className="font-bold text-slate-900 mb-3 text-[13px] flex items-center gap-2">
              <RefreshCw size={12} className="text-indigo-500" />
              {tab === 'daily' ? 'Generate Daily' : 'Generate Weekly'}
            </h3>
            {tab === 'daily' && (
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-[12px] px-3 py-2 border border-slate-200 rounded-[8px] mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            )}
            <button
              onClick={() => tab === 'daily' ? dailyMut.mutate() : weeklyMut.mutate()}
              disabled={anyPending}
              className="btn-primary w-full justify-center"
            >
              {anyPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={13} />}
              {anyPending ? 'Generating…' : 'Generate'}
            </button>
          </div>

          {/* History */}
          <div className="lp-panel p-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              {tab === 'daily' ? 'Daily History' : 'Weekly History'}
              <span className="ml-1 font-mono text-slate-300">{currentList.length}</span>
            </h4>
            {currentList.length === 0 ? (
              <p className="text-[12px] text-slate-400 py-2">No reports yet.</p>
            ) : (
              <div className="space-y-0.5 max-h-[320px] lp-scroll">
                {currentList.map((key) => (
                  <button
                    key={key}
                    onClick={() => loadReport(tab, key)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-[11px] rounded-[6px] transition-colors ${report?.label.includes(key)
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <Clock size={10} className="shrink-0 text-slate-400" />
                    {key}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: report view */}
        <div className="lg:col-span-3">
          {report && report.content ? (
            <div className="space-y-4">
              {/* Report header bar */}
              <div className="lp-panel px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-indigo-500" />
                  <h3 className="font-bold text-slate-900 text-[13px]">{report.label}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex lp-panel p-0.5">
                    <button
                      onClick={() => setViewMode('table')}
                      className={`px-2.5 py-1 text-[10px] font-medium rounded-[6px] transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <BarChart3 size={10} className="inline mr-1" />Table
                    </button>
                    <button
                      onClick={() => setViewMode('markdown')}
                      className={`px-2.5 py-1 text-[10px] font-medium rounded-[6px] transition-colors ${viewMode === 'markdown' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <FileText size={10} className="inline mr-1" />Markdown
                    </button>
                  </div>
                  <button
                    onClick={exportMd}
                    className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    <Download size={12} /> Export
                  </button>
                </div>
              </div>

              {viewMode === 'table' ? (
                <div className="flex gap-4">
                  {/* Main: KPI + events table */}
                  <div className="flex-[3] space-y-4">
                    {/* KPI summary row */}
                    {report.summary && (
                      <div className="lp-panel p-0 overflow-hidden">
                        <div className="flex divide-x divide-slate-200">
                          <KpiCell label="Total Events" value={report.summary.total ?? 0} />
                          {Object.entries(report.summary.by_kind ?? {}).map(([k, v]) => (
                            <KpiCell key={k} label={k} value={v} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Events table */}
                    <div className="lp-panel p-0 overflow-hidden">
                      <div className="max-h-[500px] lp-scroll">
                        <EventsTable events={report.events ?? []} />
                      </div>
                    </div>
                  </div>

                  {/* Right: project rollup */}
                  <div className="flex-1 space-y-4">
                    <ProjectRollup events={report.events ?? []} />
                  </div>
                </div>
              ) : (
                <div className="lp-panel p-6">
                  <article className="prose prose-slate prose-sm max-w-none prose-table:text-[12px] prose-th:bg-slate-50 prose-th:py-2 prose-th:px-3 prose-td:py-1.5 prose-td:px-3 prose-table:border-collapse prose-table:border prose-table:border-slate-200">
                    <ReactMarkdown>{report.content}</ReactMarkdown>
                  </article>
                </div>
              )}
            </div>
          ) : (
            <div className="lp-panel p-12 text-center">
              <FileBarChart size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 font-medium text-[13px]">No report selected</p>
              <p className="text-[12px] text-slate-400 mt-1">
                Generate a new report or select one from the history.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── KPI Cell ── */
function KpiCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 px-4 py-3 text-center">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xl font-black text-slate-900">{value}</div>
    </div>
  )
}

/* ── Sortable Events Table ── */
function EventsTable({ events }: { events: ActivityEvent[] }) {
  const [sortCol, setSortCol] = useState<'ts' | 'project_id' | 'kind' | 'action'>('ts')
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const av = (a[sortCol] ?? '').toString()
      const bv = (b[sortCol] ?? '').toString()
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    })
  }, [events, sortCol, sortAsc])

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  if (events.length === 0) {
    return <div className="p-6 text-center text-[12px] text-slate-400">No events in this period</div>
  }

  const kindStyle = (kind: string) => {
    switch (kind) {
      case 'step': return 'lp-chip lp-chip-indigo'
      case 'log': return 'lp-chip lp-chip-teal'
      case 'artifact': return 'lp-chip lp-chip-purple'
      case 'literature': return 'lp-chip lp-chip-indigo'
      case 'report': return 'lp-chip lp-chip-slate'
      default: return 'lp-chip lp-chip-slate'
    }
  }

  return (
    <table className="lp-table">
      <thead>
        <tr>
          {([['ts', 'Time'], ['project_id', 'Project'], ['kind', 'Type'], ['action', 'Action']] as const).map(([col, label]) => (
            <th key={col} className="cursor-pointer select-none" onClick={() => toggleSort(col)}>
              <span className="inline-flex items-center gap-1">
                {label}
                <ArrowUpDown size={9} className={sortCol === col ? 'text-indigo-500' : 'text-slate-300'} />
              </span>
            </th>
          ))}
          <th>Summary</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((ev, i) => (
          <tr key={i}>
            <td className="font-mono text-[10px] text-slate-400 whitespace-nowrap">{ev.ts?.slice(11, 19) || ev.ts?.slice(0, 16) || ''}</td>
            <td className="text-[11px] font-medium text-slate-700">{ev.project_id || '—'}</td>
            <td><span className={kindStyle(ev.kind)}>{ev.kind}</span></td>
            <td className="text-[11px] text-slate-500">{ev.action}</td>
            <td className="text-[11px] text-slate-600 max-w-[300px] truncate">{ev.summary}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ── Project Rollup Panel ── */
function ProjectRollup({ events }: { events: ActivityEvent[] }) {
  const rollup = useMemo(() => {
    const map: Record<string, { steps: number; logs: number; artifacts: number; literature: number; total: number }> = {}
    for (const ev of events) {
      const pid = ev.project_id || '_global'
      if (!map[pid]) map[pid] = { steps: 0, logs: 0, artifacts: 0, literature: 0, total: 0 }
      map[pid].total++
      if (ev.kind === 'step') map[pid].steps++
      else if (ev.kind === 'log') map[pid].logs++
      else if (ev.kind === 'artifact') map[pid].artifacts++
      else if (ev.kind === 'literature') map[pid].literature++
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
  }, [events])

  return (
    <div className="lp-panel p-4">
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Per-Project Rollup</h4>
      {rollup.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">No data</p>
      ) : (
        <div className="space-y-3">
          {rollup.map(([pid, counts]) => (
            <div key={pid}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-700 truncate">{pid === '_global' ? 'Global' : pid}</span>
                <span className="text-[10px] font-mono font-bold text-slate-500">{counts.total}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {counts.steps > 0 && <span className="lp-chip lp-chip-indigo">steps {counts.steps}</span>}
                {counts.logs > 0 && <span className="lp-chip lp-chip-teal">logs {counts.logs}</span>}
                {counts.artifacts > 0 && <span className="lp-chip lp-chip-purple">artifacts {counts.artifacts}</span>}
                {counts.literature > 0 && <span className="lp-chip lp-chip-indigo">lit {counts.literature}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
