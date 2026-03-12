import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchProject, fetchLogs, fetchArtifacts,
  addLog, addArtifact,
  fetchExecutionSteps, updateExecutionStep, generateExecution, reorderExecutionSteps, addExecutionStep, deleteExecutionStep,
  importProjectCsv, fetchProjectPapers,
  fetchMilestones, addMilestone, updateMilestone, reorderMilestones, updateKanbanItem, generateTimeline, patchProjectMeta,
  importTemplate,
  fetchCoreDescription, saveCoreDescription,
  exportLiteratureCsv, downloadReviewPrompt, downloadDesignspecPrompt,
  importDesignSpec, fetchDesignSpecStatus, fetchDesignSpecStepContext,
  downloadVcPrompt, downloadVrPrompt,
  type ExecutionStep, type PaperMeta,
  type MilestoneItem, type KanbanItem,
  type DesignSpecImportResult,
} from '../api'
import ProgressBar from '../components/ProgressBar'
import { SkeletonPage } from '../components/Skeleton'
import StructuredOverviewView from '../components/StructuredOverview'
import { useState, useRef, useMemo } from 'react'
import {
  Zap, BookOpen, FileCode, List, Clock, Package,
  Plus, CheckCircle2, Circle, Loader2, AlertTriangle, X,
  Download, Upload, Sparkles, ChevronUp, ChevronDown, FileText, Beaker, Trash2,
} from 'lucide-react'

type Tab = 'overview' | 'vibe-coding' | 'vibe-research' | 'artifacts' | 'timeline'

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaName, setMetaName] = useState('')
  const [metaDef, setMetaDef] = useState('')

  const { data: project, isLoading, isError, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
    retry: 1,
  })

  // ALL hooks must be declared unconditionally BEFORE any early returns
  const metaMut = useMutation({
    mutationFn: (data: { name?: string; definition?: string }) => patchProjectMeta(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setEditingMeta(false)
    },
  })

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: BookOpen },
    { key: 'vibe-coding', label: 'Vibe Coding', icon: Zap },
    { key: 'vibe-research', label: 'Vibe Research', icon: FileCode },
    { key: 'artifacts', label: 'Artifacts', icon: Package },
    { key: 'timeline', label: 'Timeline', icon: Clock },
  ]

  // ── Render branches (after all hooks) ──
  if (isLoading) return <SkeletonPage />

  if (isError || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle size={48} className="text-amber-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Failed to Load Project</h2>
        <p className="text-[13px] text-slate-500 mb-1">
          Could not load project <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[12px]">{id}</code>
        </p>
        <p className="text-[12px] text-slate-400 mb-6">
          {error instanceof Error ? error.message : 'The project may not exist or the backend may be unavailable.'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['project', id] })}
            className="btn-primary text-[13px] py-2 px-5"
          >
            Retry
          </button>
          <a href="/" className="btn-secondary text-[13px] py-2 px-5">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    )
  }

  const startEditMeta = () => {
    setMetaName(project.name)
    setMetaDef(project.definition)
    setEditingMeta(true)
  }

  const saveMeta = () => {
    const patch: { name?: string; definition?: string } = {}
    if (metaName !== project.name) patch.name = metaName
    if (metaDef !== project.definition) patch.definition = metaDef
    if (Object.keys(patch).length > 0) metaMut.mutate(patch)
    else setEditingMeta(false)
  }

  return (
    <div>
      {/* Hero Header */}
      <div className="relative mb-6 rounded-[16px] overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-slate-50 border border-slate-200/80 shadow-sm">
        {/* Faint grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h20v20H0z\' fill=\'none\' stroke=\'%23334155\' stroke-width=\'.5\'/%3E%3C/svg%3E")' }} />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`lp-chip ${project.priority === 'P0' ? 'lp-chip-red' :
                  project.priority === 'P1' ? 'lp-chip-amber' : 'lp-chip-slate'
                  }`}>{project.priority}</span>
                <span className={`lp-chip ${project.rag === 'red' ? 'lp-chip-red' :
                  project.rag === 'amber' ? 'lp-chip-amber' : 'lp-chip-teal'
                  }`}>{project.rag}</span>
                {project.pillar && <span className="lp-chip lp-chip-indigo">{project.pillar}</span>}
                {project.tags.map((t) => (
                  <span key={t} className="lp-chip lp-chip-slate">{t}</span>
                ))}
              </div>
              {/* Editable title + definition */}
              {editingMeta ? (
                <div className="space-y-2">
                  <input
                    value={metaName}
                    onChange={e => setMetaName(e.target.value)}
                    className="w-full text-lg font-bold px-3 py-1.5 border border-indigo-300 rounded-[10px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 text-slate-900"
                    placeholder="Project name"
                    autoFocus
                  />
                  <textarea
                    value={metaDef}
                    onChange={e => setMetaDef(e.target.value)}
                    rows={2}
                    className="w-full text-[13px] px-3 py-1.5 border border-indigo-300 rounded-[10px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 text-slate-600 resize-y"
                    placeholder="One-line description / definition"
                  />
                  <div className="flex gap-2">
                    <button onClick={saveMeta} disabled={metaMut.isPending} className="btn-primary text-[11px] py-1 px-3 !bg-emerald-600 hover:!bg-emerald-700">
                      {metaMut.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingMeta(false)} className="btn-secondary text-[11px] py-1 px-3">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="group/header cursor-pointer" onClick={startEditMeta}>
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-snug group-hover/header:text-indigo-700 transition-colors">
                    {project.name}
                    <span className="ml-2 opacity-0 group-hover/header:opacity-60 text-[11px] text-indigo-500 font-normal transition-opacity">Edit</span>
                  </h1>
                  {project.definition && (
                    <p className="text-[13px] text-slate-500 mt-1 leading-relaxed max-w-2xl">{project.definition}</p>
                  )}
                </div>
              )}
            </div>

            {/* Metrics */}
            <div className="lp-panel p-0 overflow-hidden shrink-0 shadow-sm">
              <div className="grid grid-cols-2 divide-x divide-y divide-slate-200">
                <MetricBox label="VC Progress" value={`${project.vc_progress}%`} />
                <MetricBox label="VR Progress" value={`${project.vr_progress}%`} />
                <MetricBox label="Blockers" value={String(project.blockers_count)} alert={project.blockers_count > 0} />
                <MetricBox label="Literature" value={String(project.literature_count)} />
              </div>
            </div>
          </div>

          {/* Template Actions — always visible */}
          <TemplateBanner
            projectId={id!}
            templateImportedAt={project.template_imported_at}
            onImported={() => queryClient.invalidateQueries({ queryKey: ['project', id] })}
          />

          {/* Current Step Widgets */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <CurrentStepWidget label="Vibe Coding" step={project.vc_current_step} progress={project.vc_progress} />
            <CurrentStepWidget label="Vibe Research" step={project.vr_current_step} progress={project.vr_progress} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex lp-panel p-0.5 w-fit mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-[12px] rounded-[10px] transition-colors ${tab === t.key
              ? 'bg-indigo-600 text-white font-medium shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <t.icon size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2">
            <StructuredOverviewView projectId={id!} />
          </div>
          <div className="xl:col-span-1">
            <LiteraturePanel projectId={id!} />
          </div>
        </div>
      )}
      {tab === 'vibe-coding' && <SingleExecutionTab projectId={id!} stepType="vc" logType="coding" />}
      {tab === 'vibe-research' && <SingleExecutionTab projectId={id!} stepType="vr" logType="research" />}
      {tab === 'artifacts' && <ArtifactsTab projectId={id!} />}
      {tab === 'timeline' && <TimelineTab projectId={id!} />}
    </div>
  )
}

function TemplateBanner({ projectId, templateImportedAt, onImported }: {
  projectId: string
  templateImportedAt: string | null
  onImported: () => void
}) {
  const queryClient = useQueryClient()
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [toast, setToast] = useState('')
  const [showErrors, setShowErrors] = useState(false)

  const { data: coreDesc } = useQuery({
    queryKey: ['core_description', projectId],
    queryFn: () => fetchCoreDescription(projectId),
  })

  const [descText, setDescText] = useState('')
  const [descDirty, setDescDirty] = useState(false)

  // Sync remote data to local state
  const remoteText = coreDesc?.text ?? ''
  if (!descDirty && descText !== remoteText) {
    setDescText(remoteText)
  }

  const saveMut = useMutation({
    mutationFn: () => saveCoreDescription(projectId, descText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['core_description', projectId] })
      setDescDirty(false)
      setToast('Saved')
      setTimeout(() => setToast(''), 2000)
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Save failed'),
  })

  const handleDescChange = (val: string) => {
    setDescText(val)
    setDescDirty(true)
  }

  const downloadPrompt = async (mode: 'personalized' | 'generic') => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/templates/prompt?mode=${mode}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectId}_template_prompt.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Failed to download prompt template')
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setError('')
    setSuccess('')
    setShowErrors(false)
    try {
      const text = await file.text()
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(text)
      } catch {
        setError('Invalid JSON file. Please upload valid JSON output from GPT/Gemini.')
        setImporting(false)
        return
      }
      const result = await importTemplate(projectId, parsed)
      const parts = ['overview']
      if (result.generated?.vc_steps) parts.push(`${result.generated.vc_steps} VC steps`)
      if (result.generated?.vr_steps) parts.push(`${result.generated.vr_steps} VR steps`)
      if (result.generated?.milestones) parts.push(`${result.generated.milestones} milestones`)
      if (result.generated?.artifacts) parts.push(`${result.generated.artifacts} artifacts`)
      setSuccess(`Generated: ${parts.join(', ')}`)
      onImported()
    } catch (err: unknown) {
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message)
          if (parsed.errors) {
            setError(`Template validation failed with ${parsed.errors.length} error(s)`)
            setSuccess('')
          } else {
            setError(err.message)
          }
        } catch {
          setError(err.message)
        }
      } else {
        setError('Import failed')
      }
    } finally {
      setImporting(false)
    }
    e.target.value = ''
  }

  const hasContent = !!templateImportedAt
  const charCount = descText.length
  const charWarn = charCount > 0 && charCount < 20

  return (
    <div className="mt-4 p-5 border rounded-[14px] bg-[var(--color-surface)] border-[var(--color-border)]">
      {/* Status header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-indigo-500" />
        <span className="text-[13px] font-bold text-[var(--color-text)]">Template & Content</span>
        {hasContent ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            Imported {templateImportedAt ? new Date(templateImportedAt).toLocaleDateString() : ''}
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            No template yet
          </span>
        )}
        {toast && <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">{toast}</span>}
      </div>

      {/* Core Description */}
      <div className="mb-4">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5 block">
          Core Description
          <span className={`ml-2 font-mono text-[10px] ${charWarn ? 'text-amber-500' : 'text-slate-400'}`}>
            {charCount}/4000{charWarn && ' (min 20 recommended)'}
          </span>
        </label>
        <textarea
          value={descText}
          onChange={(e) => handleDescChange(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Describe your research project in 1–3 paragraphs. This text will be injected into the prompt template to guide GPT/Gemini in generating project content."
          className="w-full text-[13px] px-3 py-2.5 border border-[var(--color-border)] rounded-[10px] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y"
        />
        <div className="flex items-center gap-2 mt-1.5">
          <button
            onClick={() => saveMut.mutate()}
            disabled={!descDirty || saveMut.isPending}
            className="btn-primary text-[11px] py-1 px-3 disabled:opacity-40"
          >
            {saveMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
            Save Description
          </button>
          {descDirty && <span className="text-[10px] text-amber-500">Unsaved changes</span>}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => downloadPrompt(descText.trim().length >= 20 ? 'personalized' : 'generic')}
          className="btn-secondary text-[11px] py-1.5 px-3"
          title={descText.trim().length >= 20 ? 'Will include your core description' : 'Add a core description (≥20 chars) to personalize'}
        >
          <Download size={12} />
          {descText.trim().length >= 20 ? 'Download Personalized Prompt' : 'Download Template Prompt'}
        </button>
        <label className="btn-primary text-[11px] py-1.5 px-3 cursor-pointer">
          {importing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {importing ? 'Importing...' : 'Upload Filled Template (JSON)'}
          <input type="file" accept=".json" onChange={handleUpload} className="hidden" disabled={importing} />
        </label>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-red-700">{error}</p>
            <button onClick={() => { setShowErrors(!showErrors); setError('') }} className="text-red-400 hover:text-red-600"><X size={14} /></button>
          </div>
        </div>
      )}
      {success && <p className="text-[12px] text-emerald-700 mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2">{success}</p>}
    </div>
  )
}

function MetricBox({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`px-4 py-2.5 ${alert ? 'bg-red-50/60' : ''}`}>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-black ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

function CurrentStepWidget({ label, step, progress }: { label: string; step: string | null; progress: number }) {
  return (
    <div className="lp-panel p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-mono font-bold text-slate-700">{progress}%</span>
      </div>
      <ProgressBar value={progress} size="md" />
      {step ? (
        <div className="mt-2 flex items-center gap-1.5 text-[12px] text-emerald-700">
          <Zap size={11} />
          <span className="font-medium">{step}</span>
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-slate-400 italic">No active step — mark one as "doing"</div>
      )}
    </div>
  )
}

// ── Single Execution Tab (VC or VR) ─────────────────────
function SingleExecutionTab({ projectId, stepType, logType }: { projectId: string; stepType: 'vc' | 'vr'; logType: string }) {
  const queryClient = useQueryClient()
  const [reorderMode, setReorderMode] = useState(false)

  const { data: coreDesc } = useQuery({
    queryKey: ['core_description', projectId],
    queryFn: () => fetchCoreDescription(projectId),
  })

  const { data: stepsData, refetch: refetchSteps } = useQuery({
    queryKey: ['execution', projectId, stepType],
    queryFn: () => fetchExecutionSteps(projectId, stepType),
  })

  const genMut = useMutation({
    mutationFn: () => generateExecution(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', projectId] })
      queryClient.invalidateQueries({ queryKey: ['checklist', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      refetchSteps()
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ stepId, update }: { stepId: string; update: Record<string, unknown> }) =>
      updateExecutionStep(projectId, stepType, stepId, update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', projectId, stepType] })
      queryClient.invalidateQueries({ queryKey: ['checklist', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  const reorderMut = useMutation({
    mutationFn: ({ from, to }: { from: number; to: number }) =>
      reorderExecutionSteps(projectId, stepType, from, to),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', projectId, stepType] })
    },
  })

  const addMut = useMutation({
    mutationFn: (body: { after_id?: string; title?: string; section?: string }) =>
      addExecutionStep(projectId, stepType, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', projectId, stepType] })
      queryClient.invalidateQueries({ queryKey: ['checklist', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (stepId: string) =>
      deleteExecutionStep(projectId, stepType, stepId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution', projectId, stepType] })
      queryClient.invalidateQueries({ queryKey: ['checklist', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  const steps = stepsData?.steps ?? []
  const done = steps.filter(s => s.status === 'done').length
  const doing = steps.filter(s => s.status === 'doing')
  const progress = steps.length ? Math.round(done / steps.length * 100) : 0
  const label = stepType === 'vc' ? 'Vibe Coding' : 'Vibe Research'

  const handleGenerate = () => {
    if (steps.length > 0 && !confirm('This will regenerate execution steps. Existing step statuses will be reset. Continue?')) return
    genMut.mutate()
  }

  const cycleStatus = (s: string) => {
    const cycle = ['todo', 'doing', 'done', 'blocked', 'todo']
    return cycle[cycle.indexOf(s) + 1] || 'todo'
  }

  const statusIcon = (s: string) => {
    if (s === 'done') return <CheckCircle2 size={16} className="text-emerald-500" />
    if (s === 'doing') return <Loader2 size={16} className="text-blue-500 animate-spin" />
    if (s === 'blocked') return <AlertTriangle size={16} className="text-red-500" />
    return <Circle size={16} className="text-slate-300" />
  }

  // Group by section
  const sectionMap = new Map<string, ExecutionStep[]>()
  for (const s of steps) {
    const sec = s.section || 'default'
    if (!sectionMap.has(sec)) sectionMap.set(sec, [])
    sectionMap.get(sec)!.push(s)
  }

  const execPromptUrl = stepType === 'vc' ? downloadVcPrompt(projectId) : downloadVrPrompt(projectId)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="lp-panel px-4 py-3 flex items-center gap-3 flex-wrap">
        <h2 className="text-[13px] font-bold text-slate-900">{label}</h2>
        <a href={execPromptUrl} download className="btn-secondary text-[11px] py-1.5 px-3 inline-flex items-center gap-1">
          <Download size={12} /> Execution Prompt
        </a>
        <button
          onClick={() => setReorderMode(r => !r)}
          className={`text-[11px] py-1.5 px-3 rounded-[8px] font-medium transition-colors inline-flex items-center gap-1 ${reorderMode ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'btn-secondary'}`}
        >
          <List size={12} /> {reorderMode ? 'Exit Reorder' : 'Reorder'}
        </button>
        <div className="ml-auto">
          <button
            onClick={handleGenerate}
            disabled={genMut.isPending}
            className="btn-primary"
          >
            {genMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={12} />}
            {genMut.isPending ? 'Generating...' : 'Generate Steps'}
          </button>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="lp-panel p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[12px] font-bold text-slate-800">{label} Progress</h3>
          <span className="text-[11px] font-mono font-bold text-slate-700">{done}/{steps.length} ({progress}%)</span>
        </div>
        <ProgressBar value={progress} size="md" />
        {doing.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-[12px] text-blue-700 bg-blue-50 px-3 py-1.5 rounded-[8px]">
            <Zap size={12} />
            <span className="font-medium">Current: {doing[0].title}</span>
          </div>
        )}
      </div>

      {/* Steps List */}
      {steps.length === 0 ? (
        <div className="lp-panel p-8 text-center">
          <Zap size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-[13px] text-slate-500 font-medium">No execution steps yet.</p>
          <p className="text-[12px] text-slate-400 mt-1">Click "Generate Steps" to create from overview milestones.</p>
        </div>
      ) : (
        <div className="lp-panel p-4 space-y-4">
          {[...sectionMap.entries()].map(([section, sectionSteps]) => (
            <div key={section}>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-1">{section}</div>
              <div className="space-y-1.5">
                {sectionSteps.map((step) => {
                  const globalIdx = steps.indexOf(step)
                  return (
                    <EditableStepRow
                      key={step.id}
                      step={step}
                      projectId={projectId}
                      statusIcon={statusIcon}
                      onStatusCycle={() => updateMut.mutate({ stepId: step.id, update: { status: cycleStatus(step.status) } })}
                      onSave={(update) => updateMut.mutate({ stepId: step.id, update })}
                      onMoveUp={globalIdx > 0 ? () => reorderMut.mutate({ from: globalIdx, to: globalIdx - 1 }) : undefined}
                      onMoveDown={globalIdx < steps.length - 1 ? () => reorderMut.mutate({ from: globalIdx, to: globalIdx + 1 }) : undefined}
                      onMoveToTop={globalIdx > 0 ? () => reorderMut.mutate({ from: globalIdx, to: 0 }) : undefined}
                      onMoveToBottom={globalIdx < steps.length - 1 ? () => reorderMut.mutate({ from: globalIdx, to: steps.length - 1 }) : undefined}
                      onAdd={() => addMut.mutate({ after_id: step.id, section: step.section || 'default' })}
                      onDelete={() => { if (confirm(`Delete step "${step.title}"?`)) deleteMut.mutate(step.id) }}
                      coreDescription={coreDesc?.text}
                      stepType={stepType}
                      reorderMode={reorderMode}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logs */}
      <LogsPanel projectId={projectId} type={logType} />
    </div>
  )
}

const promptPacks = [
  {
    id: 'implement',
    name: 'Implement Feature',
    desc: 'Step-by-step implementation with tests and verification',
    mode: 'vc' as const,
    render: (step: ExecutionStep, ctx?: string) => [
      ctx ? `## Project Context\n${ctx}\n` : '',
      `## Task: ${step.title}`,
      step.description ? `\n${step.description}` : '',
      `\n### Requirements`,
      `- ${step.acceptance || 'Complete the implementation'}`,
      `\n### Instructions`,
      `1. Read the relevant source files and understand current state`,
      `2. Plan your changes as a numbered checklist`,
      `3. Implement each change incrementally`,
      `4. Add or update tests for the new behavior`,
      `5. Run build/lint/tests and fix any issues`,
      `6. Verify acceptance criteria: ${step.acceptance || 'N/A'}`,
    ].filter(Boolean).join('\n'),
  },
  {
    id: 'debug',
    name: 'Debug & Fix',
    desc: 'Root-cause analysis approach for bugs and issues',
    mode: 'vc' as const,
    render: (step: ExecutionStep, ctx?: string) => [
      ctx ? `## Project Context\n${ctx}\n` : '',
      `## Debug: ${step.title}`,
      step.description ? `\n${step.description}` : '',
      `\n### Approach`,
      `1. Reproduce the issue and identify symptoms`,
      `2. Add logging/breakpoints to isolate the root cause`,
      `3. Fix the root cause (not symptoms)`,
      `4. Add a regression test`,
      `5. Verify the fix and remove debug logging`,
      `6. Acceptance: ${step.acceptance || 'N/A'}`,
    ].filter(Boolean).join('\n'),
  },
  {
    id: 'literature',
    name: 'Literature Review',
    desc: 'Systematic literature search and synthesis',
    mode: 'vr' as const,
    render: (step: ExecutionStep, ctx?: string) => [
      ctx ? `## Project Context\n${ctx}\n` : '',
      `## Literature Review: ${step.title}`,
      step.description ? `\n${step.description}` : '',
      `\n### Approach`,
      `1. Define search terms and inclusion criteria`,
      `2. Search databases (Semantic Scholar, Google Scholar, arXiv)`,
      `3. Screen papers for relevance`,
      `4. Extract key findings, methods, and gaps`,
      `5. Synthesize findings into a summary`,
      `6. Acceptance: ${step.acceptance || 'N/A'}`,
    ].filter(Boolean).join('\n'),
  },
  {
    id: 'writeup',
    name: 'Write-Up / Report',
    desc: 'Structure and draft a section or report',
    mode: 'any' as const,
    render: (step: ExecutionStep, ctx?: string) => [
      ctx ? `## Project Context\n${ctx}\n` : '',
      `## Write-Up: ${step.title}`,
      step.description ? `\n${step.description}` : '',
      `\n### Approach`,
      `1. Outline the section structure (headings, key points)`,
      `2. Gather evidence and references`,
      `3. Draft each subsection`,
      `4. Review for clarity, flow, and accuracy`,
      `5. Add citations and cross-references`,
      `6. Acceptance: ${step.acceptance || 'N/A'}`,
    ].filter(Boolean).join('\n'),
  },
]

function EditableStepRow({
  step, projectId, statusIcon, onStatusCycle, onSave, onMoveUp, onMoveDown, onMoveToTop, onMoveToBottom, onAdd, onDelete, coreDescription, stepType, reorderMode,
}: {
  step: ExecutionStep
  projectId: string
  statusIcon: (s: string) => React.ReactNode
  onStatusCycle: () => void
  onSave: (update: Record<string, unknown>) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onMoveToTop?: () => void
  onMoveToBottom?: () => void
  onAdd?: () => void
  onDelete?: () => void
  coreDescription?: string
  stepType?: 'vc' | 'vr'
  reorderMode?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [modalTab, setModalTab] = useState<'short' | 'expanded' | 'packs'>('short')
  const [selectedPack, setSelectedPack] = useState<string | null>(null)
  const [title, setTitle] = useState(step.title)
  const [desc, setDesc] = useState(step.description)
  const [acceptance, setAcceptance] = useState(step.acceptance)

  // Fetch DesignSpec step context when modal is opened
  const { data: dsCtx } = useQuery({
    queryKey: ['designspec_step_ctx', projectId, step.id],
    queryFn: () => fetchDesignSpecStepContext(projectId, step.id),
    enabled: showModal,
  })

  const handleSave = () => {
    const update: Record<string, unknown> = {}
    if (title !== step.title) update.title = title
    if (desc !== step.description) update.description = desc
    if (acceptance !== step.acceptance) update.acceptance = acceptance
    if (Object.keys(update).length > 0) onSave(update)
    setEditing(false)
  }

  const handleCancel = () => {
    setTitle(step.title)
    setDesc(step.description)
    setAcceptance(step.acceptance)
    setEditing(false)
  }

  // Derive short and expanded prompts (enriched with DesignSpec if available)
  const dsShort = dsCtx?.exists && dsCtx?.step_found ? dsCtx.prompt_short : ''
  const dsExpanded = dsCtx?.exists && dsCtx?.step_found ? dsCtx.prompt_expanded : ''
  const dsContext = dsCtx?.exists && dsCtx?.step_found ? dsCtx.context : ''
  const dsRefs = dsCtx?.exists && dsCtx?.step_found && dsCtx.designspec_refs?.length ? dsCtx.designspec_refs : []

  const modeLabel = stepType === 'vc' ? 'Vibe Coding' : 'Vibe Research'
  const isVC = stepType === 'vc'

  // Short prompt (6–12 lines)
  const shortPrompt = [
    `# ${step.title}`,
    `**${modeLabel} Step ${step.id}**${step.section ? ` · ${step.section}` : ''}`,
    '',
    dsShort || step.prompt_hint || `Implement: ${step.title}`,
    '',
    `Goal: ${step.description || 'See expanded prompt for details.'}`,
    step.acceptance ? `Acceptance: ${step.acceptance}` : '',
    dsRefs.length ? `Refs: ${dsRefs.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  // Expanded prompt (40–120 lines, structured)
  const deliverables = (step as unknown as Record<string, unknown>).deliverables as string[] | undefined
  const expandedPrompt = [
    `# ${modeLabel} Step: ${step.title}`,
    `**ID**: ${step.id}${step.linked_milestone ? ` · Milestone: ${step.linked_milestone}` : ''}${step.section ? ` · ${step.section}` : ''}`,
    dsRefs.length ? `**DesignSpec Refs**: ${dsRefs.join(', ')}` : '',
    '',
    '## 1. Context',
    coreDescription ? coreDescription.slice(0, 800) : `Project step ${step.id} for ${modeLabel}.`,
    '',
    dsContext ? '### DesignSpec Context' : '',
    dsContext || '',
    '',
    '## 2. Inputs',
    isVC
      ? '- Existing codebase files (use `rg` / `find` to locate)\n- Any prior step outputs referenced in deliverables\n- DesignSpec module specs (if refs provided above)'
      : '- Literature corpus (papers.jsonl, CSV exports)\n- Prior research notes and theme maps\n- DesignSpec evaluation plan (if refs provided above)',
    '',
    '## 3. Goal',
    step.description || '(no description provided)',
    '',
    '## 4. Deliverables',
    deliverables?.length ? deliverables.map(d => `- ${d}`).join('\n') : '- Completed implementation / analysis for this step',
    '',
    '## 5. Acceptance Checks',
    step.acceptance ? step.acceptance.split('; ').map(a => `- [ ] ${a}`).join('\n') : '- [ ] Step objectives met',
    '',
    `## 6. ${isVC ? 'Verification Commands' : 'Validation Checks'}`,
    isVC
      ? '- `npm run build` (zero errors)\n- `rg "TODO" --glob "*.ts"` (no leftover TODOs)\n- Run relevant unit tests\n- `git diff --stat` (confirm scope)'
      : '- All claims grounded in cited sources\n- No hallucinated references\n- Tables/figures referenced correctly\n- Word count within target range',
    '',
    '## 7. Output Format',
    isVC
      ? '```\n## Step Report: <step_id>\n- Files changed: ...\n- Tests: pass/fail\n- Build: pass/fail\n- Summary: ...\n```'
      : '```\n## Step Report: <step_id>\n- Sources reviewed: N\n- Key findings: ...\n- Gaps identified: ...\n- Next steps: ...\n```',
    '',
    '## 8. Constraints',
    '- No external API calls. Deterministic and file-driven only.',
    '- Keep changes minimal and focused on this step.',
    '- Do not delete or overwrite user edits without explicit instruction.',
    isVC ? '- Run lint/build/tests after every change.' : '- Ground every claim with a citation.',
    '',
    '## 9. Suggested Tools / Skills',
    isVC
      ? '- `rg` for code search\n- `npm run build` / `pytest` for verification\n- `git diff` for scope review\n- Editor find-and-replace for refactoring'
      : '- Literature search tools\n- Reference manager\n- Markdown editor for structured writing\n- Citation cross-checker',
    '',
    '## Prompt Seed',
    dsExpanded || step.prompt_hint || '(no prompt seed from DesignSpec)',
  ].filter(Boolean).join('\n')

  return (
    <>
      <div
        className={`group/step rounded-[10px] transition-colors ${step.status === 'doing' ? 'bg-blue-50 border border-blue-200' :
          step.status === 'done' ? 'bg-emerald-50/50 border border-emerald-100' :
            step.status === 'blocked' ? 'bg-red-50 border border-red-200' :
              'hover:bg-slate-50 border border-transparent'
          }`}
      >
        {editing ? (
          <div className="p-3 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm font-medium px-2.5 py-1.5 border border-slate-200 rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Step title"
            />
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              className="w-full text-[12px] px-2.5 py-1.5 border border-slate-200 rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y"
              placeholder="Description"
            />
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-slate-400 shrink-0" />
              <input
                value={acceptance}
                onChange={(e) => setAcceptance(e.target.value)}
                className="flex-1 text-[12px] px-2.5 py-1.5 border border-slate-200 rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Acceptance criteria"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} className="btn-primary text-[11px] py-1 px-2.5 !bg-emerald-600 hover:!bg-emerald-700">Save</button>
              <button onClick={handleCancel} className="btn-secondary text-[11px] py-1 px-2.5">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3">
            <button onClick={onStatusCycle} className="shrink-0 mt-0.5">
              {statusIcon(step.status)}
            </button>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${step.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {step.title}
              </div>
              {step.description && step.description !== step.title && (
                <div className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{step.description}</div>
              )}
              {step.acceptance && (
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 size={10} className="shrink-0" />
                  <span className="line-clamp-1">Acceptance: {step.acceptance}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {reorderMode ? (
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-[8px] px-1.5 py-1">
                  {onMoveToTop && <button onClick={onMoveToTop} className="p-1 rounded hover:bg-amber-200 text-amber-600" title="Move to top"><ChevronUp size={14} strokeWidth={3} /><ChevronUp size={14} strokeWidth={3} className="-mt-2.5" /></button>}
                  {onMoveUp && <button onClick={onMoveUp} className="p-1.5 rounded hover:bg-amber-200 text-amber-700" title="Move up"><ChevronUp size={18} strokeWidth={2.5} /></button>}
                  {onMoveDown && <button onClick={onMoveDown} className="p-1.5 rounded hover:bg-amber-200 text-amber-700" title="Move down"><ChevronDown size={18} strokeWidth={2.5} /></button>}
                  {onMoveToBottom && <button onClick={onMoveToBottom} className="p-1 rounded hover:bg-amber-200 text-amber-600" title="Move to bottom"><ChevronDown size={14} strokeWidth={3} /><ChevronDown size={14} strokeWidth={3} className="-mt-2.5" /></button>}
                </div>
              ) : (
                <div className="flex flex-col opacity-0 group-hover/step:opacity-100 transition-opacity">
                  {onMoveUp && <button onClick={onMoveUp} className="text-slate-400 hover:text-slate-700 p-0.5" title="Move up"><ChevronUp size={14} /></button>}
                  {onMoveDown && <button onClick={onMoveDown} className="text-slate-400 hover:text-slate-700 p-0.5" title="Move down"><ChevronDown size={14} /></button>}
                </div>
              )}
              <button
                onClick={() => setShowModal(true)}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-[5px] transition-colors bg-purple-50 text-purple-500 hover:bg-purple-100"
                title="Use Prompt"
              >
                <Sparkles size={10} className="inline mr-0.5" />
                Use Prompt
              </button>
              {step.linked_milestone && (
                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">{step.linked_milestone}</span>
              )}
              <span className="text-[10px] text-slate-400 uppercase font-medium w-14 text-right">{step.status}</span>
              <button
                onClick={() => setEditing(true)}
                className="opacity-0 group-hover/step:opacity-100 transition-opacity text-[10px] text-indigo-600 hover:text-indigo-800 font-medium bg-white border border-slate-200 px-1.5 py-0.5 rounded-[5px]"
              >
                Edit
              </button>
              {onAdd && (
                <button
                  onClick={onAdd}
                  className="opacity-0 group-hover/step:opacity-100 transition-opacity text-[10px] text-emerald-600 hover:text-emerald-800 font-medium bg-white border border-slate-200 px-1.5 py-0.5 rounded-[5px] inline-flex items-center gap-0.5"
                  title="Add step below"
                >
                  <Plus size={10} /> Add
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="opacity-0 group-hover/step:opacity-100 transition-opacity text-[10px] text-red-500 hover:text-red-700 font-medium bg-white border border-slate-200 px-1.5 py-0.5 rounded-[5px] inline-flex items-center gap-0.5"
                  title="Delete step"
                >
                  <Trash2 size={10} /> Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Use Prompt Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="lp-panel !rounded-[16px] shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-500" />
                <span className="font-bold text-slate-900 text-[14px]">Use Prompt — {step.title}</span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-4">
              {(['short', 'expanded', 'packs'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setModalTab(t)}
                  className={`px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors capitalize ${modalTab === t ? 'border-purple-500 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {modalTab === 'packs' ? (
                <div className="space-y-2">
                  {promptPacks.map((pack) => (
                    <button
                      key={pack.id}
                      onClick={() => setSelectedPack(selectedPack === pack.id ? null : pack.id)}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${selectedPack === pack.id
                        ? 'border-purple-300 bg-purple-50 shadow-sm'
                        : 'border-slate-200 hover:border-purple-200 hover:bg-purple-50/30'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${pack.mode === 'vc' ? 'bg-blue-100 text-blue-700' : pack.mode === 'vr' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>{pack.mode === 'vc' ? 'Coding' : pack.mode === 'vr' ? 'Research' : 'General'}</span>
                        <span className="text-[12px] font-semibold text-slate-800">{pack.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-1">{pack.desc}</p>
                      {selectedPack === pack.id && (
                        <pre className="text-[11px] text-slate-700 bg-white border border-slate-200 rounded-lg p-3 mt-2 whitespace-pre-wrap font-mono leading-relaxed">
                          {pack.render(step, coreDescription)}
                        </pre>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <pre className="text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-[10px] p-4 whitespace-pre-wrap font-mono leading-relaxed">
                  {modalTab === 'short' ? shortPrompt : expandedPrompt}
                </pre>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center gap-2">
              <button
                onClick={() => {
                  const text = modalTab === 'packs' && selectedPack
                    ? promptPacks.find(p => p.id === selectedPack)?.render(step, coreDescription) ?? ''
                    : modalTab === 'short' ? shortPrompt : expandedPrompt
                  navigator.clipboard.writeText(text)
                }}
                className="btn-primary text-[11px] py-1.5 px-3 !bg-purple-600 hover:!bg-purple-700"
                disabled={modalTab === 'packs' && !selectedPack}
              >
                Copy to Clipboard
              </button>
              <span className="text-[10px] text-slate-400">Paste into Cursor / Windsurf / Claude Code</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function LogsPanel({ projectId, type }: { projectId: string; type: string }) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [summary, setSummary] = useState('')
  const [details, setDetails] = useState('')
  const [duration, setDuration] = useState('')

  const { data: logs } = useQuery({
    queryKey: ['logs', projectId, type],
    queryFn: () => fetchLogs(projectId, type),
  })

  const addMut = useMutation({
    mutationFn: () => addLog(projectId, type, {
      type: 'progress',
      summary,
      details,
      duration_min: duration ? parseInt(duration) : undefined,
    }),
    onSuccess: () => {
      setSummary(''); setDetails(''); setDuration(''); setShowAdd(false)
      queryClient.invalidateQueries({ queryKey: ['logs', projectId, type] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  return (
    <div className="lp-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
          <Clock size={13} className="text-indigo-500" />
          Punch-in Logs — Vibe {type === 'coding' ? 'Coding' : 'Research'}
        </h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="btn-primary"
        >
          <Plus size={12} /> Log Progress
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What did you accomplish?"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Details (optional)..."
            rows={2}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          <div className="flex gap-3 items-center">
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Duration (min)"
              type="number"
              className="w-32 text-sm px-3 py-2 border border-slate-200 rounded-lg"
            />
            <button onClick={() => addMut.mutate()} disabled={!summary.trim()} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40">
              Save Log
            </button>
            <button onClick={() => setShowAdd(false)} className="text-sm text-slate-500">Cancel</button>
          </div>
        </div>
      )}

      {!logs?.length ? (
        <p className="text-sm text-slate-400 italic py-4">No logs yet. Start a session to log progress.</p>
      ) : (
        <div className="space-y-2">
          {logs.slice().reverse().map((log, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
              <div className="text-[11px] text-slate-400 font-mono shrink-0 w-32 pt-0.5">
                {new Date(log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="flex-1">
                <div className="text-sm text-slate-700 font-medium">{log.summary}</div>
                {log.details && <div className="text-[12px] text-slate-500 mt-0.5">{log.details}</div>}
              </div>
              {log.duration_min && (
                <span className="text-[11px] text-slate-400 font-mono shrink-0">{log.duration_min}m</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Artifacts Tab ────────────────────────────────────────
function ArtifactsTab({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('code')
  const [desc, setDesc] = useState('')

  const { data: artifacts, isError: artifactsError } = useQuery({
    queryKey: ['artifacts', projectId],
    queryFn: () => fetchArtifacts(projectId),
    retry: 2,
  })

  const addMut = useMutation({
    mutationFn: () => addArtifact(projectId, { type, name, description: desc }),
    onSuccess: () => {
      setName(''); setDesc(''); setShowAdd(false)
      queryClient.invalidateQueries({ queryKey: ['artifacts', projectId] })
    },
  })

  const typeColors: Record<string, string> = {
    code: 'bg-blue-50 text-blue-700',
    dataset: 'bg-emerald-50 text-emerald-700',
    paper: 'bg-purple-50 text-purple-700',
    demo: 'bg-amber-50 text-amber-700',
    figure: 'bg-pink-50 text-pink-700',
    table: 'bg-cyan-50 text-cyan-700',
    report: 'bg-slate-100 text-slate-600',
    other: 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="lp-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
            <Package size={13} className="text-indigo-500" />
            Artifacts Registry
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{artifacts?.length ?? 0} artifacts tracked</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
          <Plus size={12} /> Add Artifact
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 p-4 bg-slate-50 rounded-[10px] border border-slate-200 space-y-3">
          <div className="flex gap-3">
            <select value={type} onChange={(e) => setType(e.target.value)} className="text-[13px] px-3 py-2 border border-slate-200 rounded-[8px] bg-white">
              <option value="code">Code</option>
              <option value="dataset">Dataset</option>
              <option value="paper">Paper</option>
              <option value="figure">Figure</option>
              <option value="table">Table</option>
              <option value="demo">Demo</option>
              <option value="report">Report</option>
              <option value="other">Other</option>
            </select>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Artifact name" className="flex-1 text-[13px] px-3 py-2 border border-slate-200 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" className="w-full text-[13px] px-3 py-2 border border-slate-200 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          <div className="flex gap-2">
            <button onClick={() => addMut.mutate()} disabled={!name.trim()} className="btn-primary text-[12px] py-1.5 px-3 !bg-emerald-600 hover:!bg-emerald-700 disabled:opacity-40">Add</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary text-[12px] py-1.5 px-3">Cancel</button>
          </div>
        </div>
      )}

      {artifactsError ? (
        <div className="text-center py-8">
          <AlertTriangle size={32} className="mx-auto text-amber-400 mb-3" />
          <p className="text-slate-500 font-medium">Could not load artifacts</p>
          <p className="text-sm text-slate-400 mt-1">The artifacts data may be corrupted. Try refreshing.</p>
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['artifacts', projectId] })} className="btn-secondary text-[12px] mt-3">Retry</button>
        </div>
      ) : !artifacts?.length ? (
        <div className="text-center py-8">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No artifacts yet</p>
          <p className="text-sm text-slate-400 mt-1">Add code, datasets, papers, or demos to track deliverables.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {artifacts.map((a) => (
            <div key={a.id} className="group/artifact flex items-center gap-3 p-3 rounded-[10px] border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-colors">
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide ${typeColors[a.type] || typeColors.other}`}>{a.type}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-700">{a.name}</span>
                {a.description && <span className="text-[12px] text-slate-400 ml-2">{a.description}</span>}
                {a.path && <span className="text-[11px] text-slate-300 ml-2 font-mono">{a.path}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.linked_milestone && (
                  <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">{a.linked_milestone}</span>
                )}
                <span className="text-[10px] text-slate-300 font-mono">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Literature Panel (compact right-side) ────────────────
function LiteraturePanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [csvFormat, setCsvFormat] = useState<'auto' | 'undermind' | 'zotero'>('auto')
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number; errors: number } | null>(null)
  const [dsImporting, setDsImporting] = useState(false)
  const [dsResult, setDsResult] = useState<DesignSpecImportResult | null>(null)
  const [dsError, setDsError] = useState('')
  const dsFileRef = useRef<HTMLInputElement>(null)

  const { data: papers, isLoading } = useQuery({
    queryKey: ['project_papers', projectId, query, tagFilter],
    queryFn: () => fetchProjectPapers(projectId, query, tagFilter),
  })

  const { data: dsStatus } = useQuery({
    queryKey: ['designspec_status', projectId],
    queryFn: () => fetchDesignSpecStatus(projectId),
  })

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await importProjectCsv(projectId, file, csvFormat)
      setImportResult(result)
      queryClient.invalidateQueries({ queryKey: ['project_papers', projectId] })
    } catch {
      alert('Import failed. Check CSV format.')
    }
    e.target.value = ''
  }

  const handleDesignSpecUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDsImporting(true)
    setDsError('')
    setDsResult(null)
    try {
      const result = await importDesignSpec(projectId, file)
      setDsResult(result)
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['execution', projectId] })
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] })
      queryClient.invalidateQueries({ queryKey: ['checklist', projectId] })
      queryClient.invalidateQueries({ queryKey: ['designspec_status', projectId] })
    } catch (err: unknown) {
      setDsError(err instanceof Error ? err.message : 'Import failed')
    }
    setDsImporting(false)
    e.target.value = ''
  }

  // Collect unique tags for filter chips
  const allTags = new Set<string>()
  papers?.forEach(p => p.tags?.forEach((t: string) => allTags.add(t)))
  const sortedTags = [...allTags].sort()

  return (
    <div className="lp-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5">
          <BookOpen size={12} className="text-indigo-500" />
          Literature
          <span className="text-[10px] font-mono text-slate-400 ml-1">{papers?.length ?? 0}</span>
        </h3>
        <div className="flex items-center gap-1.5">
          <select
            value={csvFormat}
            onChange={(e) => setCsvFormat(e.target.value as 'auto' | 'undermind' | 'zotero')}
            className="text-[10px] px-1.5 py-1 rounded border border-slate-200 bg-white text-slate-500"
          >
            <option value="auto">Auto</option>
            <option value="undermind">Undermind</option>
            <option value="zotero">Zotero</option>
          </select>
          <label className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
            <Plus size={10} /> CSV
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      {/* ── Literature Toolkit ── */}
      <div className="border border-slate-100 rounded-[10px] p-2.5 bg-slate-50/50 space-y-2">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Beaker size={10} /> Literature Toolkit
          {dsStatus?.exists && <span className="lp-chip lp-chip-teal ml-auto">DesignSpec</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <a
            href={exportLiteratureCsv(projectId)}
            download
            className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded-[6px] hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <Download size={10} className="text-emerald-500 shrink-0" />
            <span>Download Full Literature CSV</span>
          </a>
          <a
            href={downloadReviewPrompt(projectId)}
            download
            className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded-[6px] hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <FileText size={10} className="text-blue-500 shrink-0" />
            <span>Download Survey Synthesis Prompt <span className="text-slate-400">(CSV → Review Doc)</span></span>
          </a>
          <a
            href={downloadDesignspecPrompt(projectId)}
            download
            className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded-[6px] hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <FileText size={10} className="text-purple-500 shrink-0" />
            <span>Download Innovation &amp; Method Design Prompt <span className="text-slate-400">(Review → JSON)</span></span>
          </a>
          <button
            onClick={() => dsFileRef.current?.click()}
            disabled={dsImporting}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-white bg-indigo-600 rounded-[6px] hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {dsImporting ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
            {dsImporting ? 'Importing...' : 'Import DesignSpec JSON (Update Overview / VC / VR / Timeline)'}
          </button>
          <input ref={dsFileRef} type="file" accept=".json" onChange={handleDesignSpecUpload} className="hidden" />
        </div>
        <p className="text-[9px] text-slate-400 leading-relaxed">
          Pipeline: Export CSV → <span className="font-medium">Prompt #1</span> Generate Review Doc → <span className="font-medium">Prompt #2</span> Generate DesignSpec JSON → Import → Project plan updates.
        </p>
        {dsError && (
          <div className="p-1.5 bg-red-50 border border-red-200 rounded text-[10px] text-red-600 flex items-center justify-between">
            <span className="line-clamp-2">{dsError}</span>
            <button onClick={() => setDsError('')} className="text-red-400 shrink-0 ml-1"><X size={10} /></button>
          </div>
        )}
        {dsResult && (
          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-[10px] text-emerald-700 space-y-0.5">
            <div className="flex items-center justify-between font-medium">
              <span>DesignSpec Applied</span>
              <button onClick={() => setDsResult(null)} className="text-emerald-500"><X size={10} /></button>
            </div>
            <div>Overview: {dsResult.summary.overview_sections_updated} sections updated</div>
            <div>VC steps: {dsResult.summary.vibe_coding_steps.before} → {dsResult.summary.vibe_coding_steps.after}</div>
            <div>VR steps: {dsResult.summary.vibe_research_steps.before} → {dsResult.summary.vibe_research_steps.after}</div>
            <div>Milestones: {dsResult.summary.milestones.before} → {dsResult.summary.milestones.after}</div>
            <div>Artifacts: {dsResult.summary.artifacts.before} → {dsResult.summary.artifacts.after}</div>
          </div>
        )}
      </div>

      {importResult && (
        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-700 flex items-center justify-between">
          <span>{importResult.imported} imported · {importResult.duplicates} dup</span>
          <button onClick={() => setImportResult(null)} className="text-emerald-500"><X size={12} /></button>
        </div>
      )}

      <input
        placeholder="Search papers..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full text-[12px] px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />

      {/* Tag filter chips */}
      {sortedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setTagFilter('')}
            className={`lp-chip cursor-pointer transition-colors ${!tagFilter ? 'lp-chip-indigo' : 'lp-chip-slate hover:border-slate-300'}`}
          >All</button>
          {sortedTags.map(t => (
            <button
              key={t}
              onClick={() => setTagFilter(tagFilter === t ? '' : t)}
              className={`lp-chip cursor-pointer transition-colors ${tagFilter === t ? 'lp-chip-indigo' : 'lp-chip-slate hover:border-slate-300'}`}
            >{t}</button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-[12px] text-slate-400">Loading...</div>
      ) : !papers?.length ? (
        <div className="py-6 text-center">
          <BookOpen size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-[12px] text-slate-500">No papers yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Import CSV to add papers</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[500px] lp-scroll">
          {papers.map((p: PaperMeta) => (
            <div key={p.paper_id} className="p-2 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
              <div className="text-[12px] font-medium text-slate-700 line-clamp-2 leading-snug">{p.title}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-400 truncate flex-1">{p.authors?.substring(0, 40)}</span>
                {p.year && <span className="text-[10px] font-mono text-slate-400">{p.year}</span>}
                {p.citation_count != null && <span className="text-[10px] font-mono text-slate-300">{p.citation_count}c</span>}
              </div>
              {p.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.tags.slice(0, 3).map(t => (
                    <button
                      key={t}
                      onClick={() => setTagFilter(tagFilter === t ? '' : t)}
                      className={`lp-chip cursor-pointer transition-colors ${tagFilter === t ? 'lp-chip-indigo' : 'lp-chip-slate hover:border-slate-300'}`}
                    >{t}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Timeline Tab (single canonical source: milestones) ──
const STATUS_TO_COL: Record<string, string> = { pending: 'backlog', in_progress: 'doing', done: 'done', overdue: 'backlog' }

function TimelineTab({ projectId }: { projectId: string }) {
  const [view, setView] = useState<'timeline' | 'milestones' | 'kanban'>('timeline')
  const [reorderMode, setReorderMode] = useState(false)
  const queryClient = useQueryClient()
  const TL_KEY = ['milestones', projectId]

  const { data: milestones } = useQuery({
    queryKey: TL_KEY,
    queryFn: () => fetchMilestones(projectId),
  })

  // Derive kanban from milestones (client-side projection)
  const kanbanItems = useMemo(() => {
    if (!milestones) return []
    return milestones.map((m: MilestoneItem) => ({
      id: m.id,
      title: m.title,
      column: STATUS_TO_COL[m.status] || 'backlog',
      description: m.acceptance,
      linked_milestone: m.id,
    }))
  }, [milestones])

  const invalidateTimeline = () => queryClient.invalidateQueries({ queryKey: TL_KEY })

  const genMut = useMutation({
    mutationFn: () => generateTimeline(projectId),
    onSuccess: invalidateTimeline,
  })

  const mUpdate = useMutation({
    mutationFn: ({ id, update }: { id: string; update: Record<string, unknown> }) =>
      updateMilestone(projectId, id, update),
    onSuccess: invalidateTimeline,
  })

  const mAdd = useMutation({
    mutationFn: (data: Record<string, unknown>) => addMilestone(projectId, data),
    onSuccess: invalidateTimeline,
  })

  const mReorder = useMutation({
    mutationFn: ({ from, to }: { from: number; to: number }) =>
      reorderMilestones(projectId, from, to),
    onSuccess: invalidateTimeline,
  })

  const kUpdate = useMutation({
    mutationFn: ({ id, update }: { id: string; update: Record<string, unknown> }) =>
      updateKanbanItem(projectId, id, update),
    onSuccess: invalidateTimeline,
  })

  const handleGenerate = () => {
    if ((milestones?.length || 0) > 0 && !confirm('Regenerate timeline? This overwrites existing milestones.')) return
    genMut.mutate()
  }

  const mStatusColor = (s: string) => {
    if (s === 'done') return 'bg-emerald-100 text-emerald-700'
    if (s === 'in_progress') return 'bg-blue-100 text-blue-700'
    if (s === 'overdue') return 'bg-red-100 text-red-700'
    return 'bg-slate-100 text-slate-600'
  }

  const cycleMilestoneStatus = (s: string) => {
    const c = ['pending', 'in_progress', 'done', 'overdue', 'pending']
    return c[c.indexOf(s) + 1] || 'pending'
  }

  const columns = ['backlog', 'doing', 'done'] as const
  const columnLabels: Record<string, string> = { backlog: 'Backlog', doing: 'In Progress', done: 'Done' }
  const columnColors: Record<string, string> = {
    backlog: 'border-t-slate-400',
    doing: 'border-t-blue-500',
    done: 'border-t-emerald-500',
  }

  const mDone = milestones?.filter(m => m.status === 'done').length ?? 0
  const mTotal = milestones?.length ?? 0

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="flex lp-panel p-0.5">
          <button
            onClick={() => setView('timeline')}
            className={`px-3.5 py-2 text-[12px] font-medium rounded-[10px] transition-colors ${view === 'timeline' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Clock size={12} className="inline mr-1.5 -mt-0.5" />
            Timeline
          </button>
          <button
            onClick={() => setView('milestones')}
            className={`px-3.5 py-2 text-[12px] font-medium rounded-[10px] transition-colors ${view === 'milestones' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Milestones {mTotal > 0 && <span className="ml-1 text-[10px] opacity-80">{mDone}/{mTotal}</span>}
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`px-3.5 py-2 text-[12px] font-medium rounded-[10px] transition-colors ${view === 'kanban' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <List size={12} className="inline mr-1.5 -mt-0.5" />
            Kanban
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setReorderMode(r => !r)}
            className={`text-[11px] py-1.5 px-3 rounded-[8px] font-medium transition-colors inline-flex items-center gap-1 ${reorderMode ? 'bg-amber-100 text-amber-700 border border-amber-300' : 'btn-secondary'}`}
          >
            <List size={12} /> {reorderMode ? 'Exit Reorder' : 'Reorder'}
          </button>
          <button
            onClick={() => mAdd.mutate({ title: 'New Milestone' })}
            disabled={mAdd.isPending}
            className="btn-secondary text-[12px] py-1.5 px-3"
          >
            <Plus size={13} /> Add Milestone
          </button>
          <button
            onClick={handleGenerate}
            disabled={genMut.isPending}
            className="btn-primary text-[12px] py-1.5 px-3"
          >
            {genMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Clock size={13} />}
            {genMut.isPending ? 'Generating...' : 'Generate Timeline'}
          </button>
        </div>
      </div>

      {/* Vertical Timeline View */}
      {view === 'timeline' && (
        !milestones?.length ? (
          <div className="lp-panel p-8 text-center">
            <Clock size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-[13px] text-slate-500 font-medium">No milestones yet.</p>
            <p className="text-[12px] text-slate-400 mt-1">Click "Generate Timeline" to create from overview.</p>
          </div>
        ) : (
          <div className="relative pl-8">
            {/* Vertical line */}
            <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-200" />
            <div className="space-y-6">
              {milestones.map((m: MilestoneItem, _idx: number) => {
                const dotColor = m.status === 'done' ? 'bg-emerald-500' :
                  m.status === 'in_progress' ? 'bg-blue-500' :
                    m.status === 'overdue' ? 'bg-red-500' : 'bg-slate-300'
                const borderColor = m.status === 'done' ? 'border-emerald-200' :
                  m.status === 'in_progress' ? 'border-blue-200' :
                    m.status === 'overdue' ? 'border-red-200' : 'border-slate-200'
                return (
                  <div key={m.id} className="relative">
                    {/* Dot */}
                    <div className={`absolute -left-8 top-4 w-3 h-3 rounded-full ${dotColor} ring-4 ring-white`} />
                    {/* Card */}
                    <div className={`bg-white rounded-[12px] border ${borderColor} p-4 hover:shadow-sm transition-shadow`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-mono font-bold text-slate-400">{m.id}</span>
                            <span className="text-[11px] font-mono text-slate-400">{m.deadline || '—'}</span>
                          </div>
                          <h4 className="text-sm font-semibold text-slate-800">{m.title}</h4>
                          {m.acceptance && (
                            <div className="text-[12px] text-slate-500 mt-1.5 flex items-start gap-1.5">
                              <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-slate-400" />
                              <span>{m.acceptance}</span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => mUpdate.mutate({ id: m.id, update: { status: cycleMilestoneStatus(m.status) } })}
                          className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full shrink-0 ${mStatusColor(m.status)}`}
                        >{m.status}</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      )}

      {/* Milestones View */}
      {view === 'milestones' && (
        !milestones?.length ? (
          <div className="lp-panel p-8 text-center">
            <Clock size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-[13px] text-slate-500 font-medium">No milestones yet.</p>
            <p className="text-[12px] text-slate-400 mt-1">Click "Generate Timeline" to create from overview.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {milestones.map((m: MilestoneItem, idx: number) => (
              <EditableMilestoneRow
                key={m.id}
                milestone={m}
                statusColor={mStatusColor}
                onStatusCycle={() => mUpdate.mutate({ id: m.id, update: { status: cycleMilestoneStatus(m.status) } })}
                onSave={(update) => mUpdate.mutate({ id: m.id, update })}
                onMoveUp={idx > 0 ? () => mReorder.mutate({ from: idx, to: idx - 1 }) : undefined}
                onMoveDown={idx < milestones.length - 1 ? () => mReorder.mutate({ from: idx, to: idx + 1 }) : undefined}
                onMoveToTop={idx > 0 ? () => mReorder.mutate({ from: idx, to: 0 }) : undefined}
                onMoveToBottom={idx < milestones.length - 1 ? () => mReorder.mutate({ from: idx, to: milestones.length - 1 }) : undefined}
                reorderMode={reorderMode}
              />
            ))}
          </div>
        )
      )}

      {/* Kanban View — derived from milestones */}
      {view === 'kanban' && (
        !kanbanItems.length ? (
          <div className="lp-panel p-8 text-center">
            <List size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-[13px] text-slate-500 font-medium">No kanban items yet.</p>
            <p className="text-[12px] text-slate-400 mt-1">Click "Generate Timeline" to create from overview.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {columns.map(col => {
              const items = kanbanItems.filter(k => k.column === col)
              return (
                <div key={col} className={`lp-panel border-t-4 ${columnColors[col]}`}>
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-500 uppercase">{columnLabels[col]}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">{items.length}</span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2 min-h-[120px]">
                    {items.map((item) => (
                      <EditableKanbanCard
                        key={item.id}
                        item={item as KanbanItem}
                        column={col}
                        onMove={(nextCol) => kUpdate.mutate({ id: item.id, update: { column: nextCol } })}
                        onSave={(update) => kUpdate.mutate({ id: item.id, update })}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

function EditableMilestoneRow({
  milestone: m, statusColor, onStatusCycle, onSave, onMoveUp, onMoveDown, onMoveToTop, onMoveToBottom, reorderMode,
}: {
  milestone: MilestoneItem
  statusColor: (s: string) => string
  onStatusCycle: () => void
  onSave: (update: Record<string, unknown>) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onMoveToTop?: () => void
  onMoveToBottom?: () => void
  reorderMode?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(m.title)
  const [deadline, setDeadline] = useState(m.deadline || '')
  const [acceptance, setAcceptance] = useState(m.acceptance || '')

  const handleSave = () => {
    const update: Record<string, unknown> = {}
    if (title !== m.title) update.title = title
    if (deadline !== (m.deadline || '')) update.deadline = deadline
    if (acceptance !== (m.acceptance || '')) update.acceptance = acceptance
    if (Object.keys(update).length > 0) onSave(update)
    setEditing(false)
  }

  const handleCancel = () => {
    setTitle(m.title); setDeadline(m.deadline || ''); setAcceptance(m.acceptance || '')
    setEditing(false)
  }

  return (
    <div className="group/milestone lp-panel hover:shadow-sm transition-shadow">
      {editing ? (
        <div className="p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 w-10 shrink-0">{m.id}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 text-sm font-medium px-2.5 py-1.5 border border-slate-200 rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Milestone title"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-28 text-[12px] font-mono px-2.5 py-1.5 border border-slate-200 rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="W1, W2..."
            />
            <input
              value={acceptance}
              onChange={(e) => setAcceptance(e.target.value)}
              className="flex-1 text-[12px] px-2.5 py-1.5 border border-slate-200 rounded-[8px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="Acceptance criteria"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary text-[11px] py-1 px-2.5 !bg-emerald-600 hover:!bg-emerald-700">Save</button>
            <button onClick={handleCancel} className="btn-secondary text-[11px] py-1 px-2.5">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-[11px] font-mono font-bold text-slate-400 w-10 shrink-0">{m.id}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-700">{m.title}</div>
            {m.acceptance && (
              <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <CheckCircle2 size={10} className="shrink-0" />
                <span className="line-clamp-1">{m.acceptance}</span>
              </div>
            )}
          </div>
          <span className="text-[11px] font-mono text-slate-500 shrink-0">{m.deadline || '—'}</span>
          {reorderMode ? (
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-[8px] px-1.5 py-1">
              {onMoveToTop && <button onClick={onMoveToTop} className="p-1 rounded hover:bg-amber-200 text-amber-600" title="Move to top"><ChevronUp size={14} strokeWidth={3} /><ChevronUp size={14} strokeWidth={3} className="-mt-2.5" /></button>}
              {onMoveUp && <button onClick={onMoveUp} className="p-1.5 rounded hover:bg-amber-200 text-amber-700" title="Move up"><ChevronUp size={18} strokeWidth={2.5} /></button>}
              {onMoveDown && <button onClick={onMoveDown} className="p-1.5 rounded hover:bg-amber-200 text-amber-700" title="Move down"><ChevronDown size={18} strokeWidth={2.5} /></button>}
              {onMoveToBottom && <button onClick={onMoveToBottom} className="p-1 rounded hover:bg-amber-200 text-amber-600" title="Move to bottom"><ChevronDown size={14} strokeWidth={3} /><ChevronDown size={14} strokeWidth={3} className="-mt-2.5" /></button>}
            </div>
          ) : (
            <div className="flex flex-col opacity-0 group-hover/milestone:opacity-100 transition-opacity">
              {onMoveUp && <button onClick={onMoveUp} className="text-slate-400 hover:text-slate-700 p-0.5" title="Move up"><ChevronUp size={14} /></button>}
              {onMoveDown && <button onClick={onMoveDown} className="text-slate-400 hover:text-slate-700 p-0.5" title="Move down"><ChevronDown size={14} /></button>}
            </div>
          )}
          <button
            onClick={onStatusCycle}
            className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full shrink-0 ${statusColor(m.status)}`}
          >{m.status}</button>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover/milestone:opacity-100 transition-opacity text-[10px] text-indigo-600 hover:text-indigo-800 font-medium bg-white border border-slate-200 px-1.5 py-0.5 rounded-[5px]"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  )
}

function EditableKanbanCard({
  item, column, onMove, onSave,
}: {
  item: KanbanItem
  column: string
  onMove: (col: string) => void
  onSave: (update: Record<string, unknown>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [desc, setDesc] = useState(item.description || '')

  const nextCol = column === 'backlog' ? 'doing' : column === 'doing' ? 'done' : 'backlog'

  const handleSave = () => {
    const update: Record<string, unknown> = {}
    if (title !== item.title) update.title = title
    if (desc !== (item.description || '')) update.description = desc
    if (Object.keys(update).length > 0) onSave(update)
    setEditing(false)
  }

  const handleCancel = () => {
    setTitle(item.title); setDesc(item.description || '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="p-2.5 rounded-[8px] border border-indigo-200 bg-indigo-50/30 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-[12px] font-medium px-2 py-1 border border-slate-200 rounded-[6px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="Card title"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
          className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded-[6px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y"
          placeholder="Description"
        />
        <div className="flex gap-1.5">
          <button onClick={handleSave} className="btn-primary text-[10px] py-0.5 px-2 !bg-emerald-600 hover:!bg-emerald-700">Save</button>
          <button onClick={handleCancel} className="btn-secondary text-[10px] py-0.5 px-2">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="group/kanban p-2.5 rounded-[8px] border border-slate-100 hover:border-slate-300 bg-slate-50/50 hover:bg-white transition-colors">
      <div className="flex items-start justify-between gap-1">
        <div
          onClick={() => onMove(nextCol)}
          className="flex-1 cursor-pointer"
        >
          <div className="text-[12px] font-medium text-slate-700 line-clamp-2">{item.title}</div>
          {item.description && (
            <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">{item.description}</div>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover/kanban:opacity-100 transition-opacity text-[9px] text-indigo-600 hover:text-indigo-800 font-medium bg-white border border-slate-200 px-1 py-0.5 rounded-[4px] shrink-0"
        >
          Edit
        </button>
      </div>
      {item.linked_milestone && (
        <span className="inline-block mt-1.5 text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">{item.linked_milestone}</span>
      )}
    </div>
  )
}
