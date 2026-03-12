import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchHealth, reindexLiterature, rebuildCache, exportSummary } from '../api'
import { Settings, Database, FolderOpen, Loader2, CheckCircle2, Download, RefreshCw, BookOpen } from 'lucide-react'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { data: health } = useQuery({ queryKey: ['health'], queryFn: fetchHealth })
  const [feedback, setFeedback] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const reindexMut = useMutation({
    mutationFn: reindexLiterature,
    onSuccess: (d) => {
      setFeedback({ msg: `Reindexed ${d.papers_indexed} papers`, type: 'ok' })
      queryClient.invalidateQueries()
    },
    onError: () => setFeedback({ msg: 'Reindex failed', type: 'err' }),
  })

  const rebuildMut = useMutation({
    mutationFn: rebuildCache,
    onSuccess: (d) => {
      const n = Object.values(d.projects).filter(v => v === 'rebuilt').length
      setFeedback({ msg: `Rebuilt cache for ${n} projects`, type: 'ok' })
      queryClient.invalidateQueries()
    },
    onError: () => setFeedback({ msg: 'Rebuild failed', type: 'err' }),
  })

  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null)

  const exportMut = useMutation({
    mutationFn: exportSummary,
    onSuccess: (d) => {
      setExportData(d)
      setFeedback({ msg: `Exported summary for ${(d.projects as unknown[]).length} projects`, type: 'ok' })
    },
    onError: () => setFeedback({ msg: 'Export failed', type: 'err' }),
  })

  const handleExportDownload = () => {
    if (!exportData) return
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vibeops-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const anyLoading = reindexMut.isPending || rebuildMut.isPending || exportMut.isPending

  return (
    <div>
      {/* Header — consistent lp-panel */}
      <div className="lp-panel px-5 py-4 mb-6">
        <h1 className="text-[15px] font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-[12px] text-slate-500 mt-0.5">System configuration and data maintenance</p>
      </div>

      {feedback && (
        <div className={`mb-4 p-3 rounded-[10px] text-[13px] flex items-center gap-2 ${feedback.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <CheckCircle2 size={14} />
          {feedback.msg}
          <button onClick={() => setFeedback(null)} className="ml-auto text-[11px] opacity-60 hover:opacity-100">dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="lp-panel p-5">
          <h3 className="font-bold text-[13px] text-slate-900 mb-4 flex items-center gap-2">
            <Settings size={14} className="text-indigo-500" />
            System Info
          </h3>
          <div className="space-y-0 text-[12px]">
            <div className="flex justify-between py-2.5 border-b border-slate-100">
              <span className="text-slate-500">App</span>
              <span className="font-mono text-slate-700 font-medium">VibeScholar</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-slate-100">
              <span className="text-slate-500">Version</span>
              <span className="font-mono text-slate-700">{health?.version ?? '—'}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-slate-100">
              <span className="text-slate-500">Status</span>
              <span className={`font-mono font-medium ${health?.status === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                {health?.status === 'ok' ? '● Online' : health?.status ?? '—'}
              </span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-slate-500">Stack</span>
              <span className="text-[12px] text-slate-500">FastAPI + React + TailwindCSS</span>
            </div>
          </div>
        </div>

        <div className="lp-panel p-5">
          <h3 className="font-bold text-[13px] text-slate-900 mb-4 flex items-center gap-2">
            <FolderOpen size={14} className="text-indigo-500" />
            Data Paths
          </h3>
          <div className="space-y-0 text-[12px]">
            <div className="flex justify-between py-2.5 border-b border-slate-100">
              <span className="text-slate-500">Data Root</span>
              <span className="font-mono text-slate-600 text-[12px]">VibeScholar data root</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-slate-100">
              <span className="text-slate-500">Projects</span>
              <span className="font-mono text-slate-600 text-[12px]">./projects</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-slate-100">
              <span className="text-slate-500">Literature</span>
              <span className="font-mono text-slate-600 text-[12px]">./data/literature</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-slate-100">
              <span className="text-slate-500">Reports</span>
              <span className="font-mono text-slate-600 text-[12px]">./reports</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-slate-500">Templates</span>
              <span className="font-mono text-slate-600 text-[12px]">./templates</span>
            </div>
          </div>
        </div>

        <div className="lp-panel p-5 lg:col-span-2">
          <h3 className="font-bold text-[13px] text-slate-900 mb-1 flex items-center gap-2">
            <Database size={14} className="text-indigo-500" />
            Data Maintenance
          </h3>
          <p className="text-[11px] text-slate-400 mb-4">Manage literature index, project caches, and data exports.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => reindexMut.mutate()}
              disabled={anyLoading}
              className="card flex items-center gap-3 px-4 py-3.5 text-left disabled:opacity-50"
            >
              {reindexMut.isPending ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <BookOpen size={14} className="text-indigo-400" />}
              <div>
                <div className="text-[12px] font-medium text-slate-700">Reindex Literature</div>
                <div className="text-[10px] text-slate-400">Rebuild global papers index</div>
              </div>
            </button>
            <button
              onClick={() => {
                if (!confirm('This will regenerate all steps and timelines. Existing status data will be reset. Continue?')) return
                rebuildMut.mutate()
              }}
              disabled={anyLoading}
              className="card flex items-center gap-3 px-4 py-3.5 text-left disabled:opacity-50"
            >
              {rebuildMut.isPending ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <RefreshCw size={14} className="text-amber-400" />}
              <div>
                <div className="text-[12px] font-medium text-slate-700">Rebuild Cache</div>
                <div className="text-[10px] text-slate-400">Regenerate steps and timelines</div>
              </div>
            </button>
            <button
              onClick={() => exportMut.mutate()}
              disabled={anyLoading}
              className="card flex items-center gap-3 px-4 py-3.5 text-left disabled:opacity-50"
            >
              {exportMut.isPending ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <Download size={14} className="text-emerald-400" />}
              <div>
                <div className="text-[12px] font-medium text-slate-700">Export Summary</div>
                <div className="text-[10px] text-slate-400">Download data summary as JSON</div>
              </div>
            </button>
          </div>

          {exportData && (
            <div className="mt-4 p-4 bg-slate-50 rounded-[10px] border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-medium text-slate-700">Export Preview</span>
                <button onClick={handleExportDownload} className="flex items-center gap-1.5 text-[12px] text-indigo-600 hover:text-indigo-700 font-medium">
                  <Download size={13} /> Download JSON
                </button>
              </div>
              <pre className="text-[11px] text-slate-500 overflow-auto max-h-48 font-mono bg-white p-3 rounded-[8px] border border-slate-100">
                {JSON.stringify(exportData, null, 2)}
              </pre>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
