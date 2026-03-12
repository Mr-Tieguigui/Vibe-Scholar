import { useQuery } from '@tanstack/react-query'
import { fetchOverviewStructured, type OverviewSection } from '../api'
import {
  ChevronDown, ChevronRight, Target, Lightbulb, ScanSearch, HelpCircle,
  Layers, GitBranch, BarChart3, Package, Flag, AlertTriangle,
  BookOpen, CheckSquare, Square, ArrowRight,
} from 'lucide-react'
import { useState } from 'react'

/** Safely convert any value to a renderable string. Prevents 'Objects are not valid as React child'. */
function safeText(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v == null) return ''
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    return String(o.title ?? o.text ?? o.name ?? o.label ?? o.value ?? o.term ?? o.description ?? JSON.stringify(v))
  }
  return String(v)
}

export default function StructuredOverviewView({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['overview_structured', projectId],
    queryFn: () => fetchOverviewStructured(projectId),
    retry: 1,
  })

  if (isLoading) return <OverviewSkeleton />
  if (isError || !data || !data.sections?.length) return <EmptyOverview />

  return (
    <div className="space-y-4">
      {data.sections.map((section, i) => (
        <SectionRenderer key={i} section={section} />
      ))}
    </div>
  )
}

function SectionRendererInner({ section }: { section: OverviewSection }) {
  switch (section.type) {
    case 'definition': return <DefinitionCard section={section} />
    case 'motivation': return <MotivationCard section={section} />
    case 'scope': return <ScopeCard section={section} />
    case 'questions': return <QuestionsCard section={section} />
    case 'concepts': return <ConceptsAccordion section={section} />
    case 'pipeline': return <PipelineCard section={section} />
    case 'evaluation': return <EvaluationAccordion section={section} />
    case 'deliverables': return <DeliverablesCard section={section} />
    case 'milestones': return <MilestonesTable section={section} />
    case 'risks': return <RisksAccordion section={section} />
    case 'literature': return <LiteratureCard section={section} />
    case 'actions': return <ActionsCard section={section} />
    default: return <GenericCard section={section} />
  }
}

function SectionRenderer({ section }: { section: OverviewSection }) {
  try {
    return <SectionRendererInner section={section} />
  } catch {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-4 text-sm text-red-600">
        Failed to render section: {section.heading || section.type || 'unknown'}
      </div>
    )
  }
}

// ── Section Header ──────────────────────────────────────
const SECTION_ICONS: Record<string, React.ElementType> = {
  definition: Target,
  motivation: Lightbulb,
  scope: ScanSearch,
  questions: HelpCircle,
  concepts: Layers,
  pipeline: GitBranch,
  evaluation: BarChart3,
  deliverables: Package,
  milestones: Flag,
  risks: AlertTriangle,
  literature: BookOpen,
  actions: CheckSquare,
}

const SECTION_COLORS: Record<string, string> = {
  definition: 'border-l-emerald-500 bg-emerald-50/30',
  motivation: 'border-l-blue-500 bg-blue-50/30',
  scope: 'border-l-violet-500 bg-violet-50/30',
  questions: 'border-l-amber-500 bg-amber-50/30',
  concepts: 'border-l-indigo-500',
  pipeline: 'border-l-cyan-500',
  evaluation: 'border-l-orange-500',
  deliverables: 'border-l-emerald-500',
  milestones: 'border-l-blue-500',
  risks: 'border-l-red-500',
  literature: 'border-l-purple-500',
  actions: 'border-l-teal-500 bg-teal-50/30',
}

function SectionHeader({ type, heading }: { type: string; heading: string }) {
  const Icon = SECTION_ICONS[type] || Layers
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className="text-slate-500 shrink-0" />
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{heading}</h3>
    </div>
  )
}

function Card({ type, heading, children, className = '' }: {
  type: string; heading: string; children: React.ReactNode; className?: string
}) {
  const accent = SECTION_COLORS[type] || 'border-l-slate-300'
  return (
    <div className={`lp-panel border-l-4 ${accent} p-5 ${className}`}>
      <SectionHeader type={type} heading={heading} />
      {children}
    </div>
  )
}

// ── Definition ──────────────────────────────────────────
function DefinitionCard({ section }: { section: OverviewSection }) {
  return (
    <Card type="definition" heading={section.heading}>
      <p className="text-base text-slate-700 leading-relaxed font-medium">
        {section.content}
      </p>
    </Card>
  )
}

// ── Motivation ──────────────────────────────────────────
function MotivationCard({ section }: { section: OverviewSection }) {
  return (
    <Card type="motivation" heading={section.heading}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Context</div>
          <ul className="space-y-1.5">
            {(section.context ?? []).map((c, i) => (
              <li key={i} className="text-sm text-slate-600 leading-relaxed flex gap-2">
                <span className="text-slate-300 shrink-0 mt-1">•</span>
                <span>{safeText(c)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Impact</div>
          <ul className="space-y-1.5">
            {(section.impact ?? []).map((c, i) => (
              <li key={i} className="text-sm text-slate-600 leading-relaxed flex gap-2">
                <ArrowRight size={12} className="text-emerald-500 shrink-0 mt-1" />
                <span>{safeText(c)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}

// ── Scope ───────────────────────────────────────────────
function ScopeCard({ section }: { section: OverviewSection }) {
  return (
    <Card type="scope" heading={section.heading}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100">
          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">✓ In Scope</div>
          <ul className="space-y-1">
            {(section.in_scope ?? []).map((s, i) => (
              <li key={i} className="text-sm text-slate-700 flex gap-2">
                <span className="text-emerald-500 shrink-0">✓</span>
                <span>{safeText(s)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">✗ Out of Scope</div>
          <ul className="space-y-1">
            {(section.out_scope ?? []).map((s, i) => (
              <li key={i} className="text-sm text-slate-500 flex gap-2">
                <span className="text-slate-400 shrink-0">✗</span>
                <span>{safeText(s)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  )
}

// ── Key Questions (chips) ───────────────────────────────
function QuestionsCard({ section }: { section: OverviewSection }) {
  const items = (section.items ?? []) as { id?: string; text?: string }[]
  return (
    <Card type="questions" heading={section.heading}>
      <div className="flex flex-wrap gap-2">
        {items.map((q, i) => (
          <div key={i} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm">
            <span className="text-[10px] font-bold text-amber-600 uppercase shrink-0">{q.id ?? `Q${i + 1}`}</span>
            <span className="text-slate-700">{q.text}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Concepts (Accordion) ────────────────────────────────
function ConceptsAccordion({ section }: { section: OverviewSection }) {
  const items = (section.items ?? []) as { term?: string; description?: string }[]
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <Card type="concepts" heading={section.heading}>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
              <span className="text-sm font-semibold text-slate-800">{item.term}</span>
              {openIdx === i ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            </button>
            {openIdx === i && (
              <div className="px-4 py-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                {item.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Pipeline ────────────────────────────────────────────
function PipelineCard({ section }: { section: OverviewSection }) {
  const steps = (section.steps ?? []) as { step?: number; label?: string; description?: string }[]
  return (
    <Card type="pipeline" heading={section.heading}>
      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-3 items-start">
            <div className="w-7 h-7 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              {s.step ?? i + 1}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-800">{s.label}</div>
              <div className="text-sm text-slate-600 mt-0.5">{s.description}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Evaluation (Accordion) ──────────────────────────────
function EvaluationAccordion({ section }: { section: OverviewSection }) {
  const items = (section.items ?? []) as { label?: string; value?: string }[]
  const [open, setOpen] = useState(false)

  return (
    <Card type="evaluation" heading={section.heading}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{items.length} evaluation criteria</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <span className="font-semibold text-slate-700 shrink-0 min-w-[120px]">{item.label}:</span>
              <span className="text-slate-600">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Deliverables ────────────────────────────────────────
function DeliverablesCard({ section }: { section: OverviewSection }) {
  const rawItems = section.items ?? []
  return (
    <Card type="deliverables" heading={section.heading}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rawItems.map((d, i) => {
          const text = typeof d === 'string' ? d : (d as Record<string, unknown>)?.title ?? (d as Record<string, unknown>)?.text ?? JSON.stringify(d)
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
              <Package size={13} className="text-emerald-500 shrink-0" />
              {String(text)}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ── Milestones (Table) ──────────────────────────────────
function MilestonesTable({ section }: { section: OverviewSection }) {
  const items = (section.items ?? []) as {
    id?: string; week?: string; title?: string; acceptance?: string; status?: string
  }[]
  return (
    <Card type="milestones" heading={section.heading}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase w-12">ID</th>
              <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase w-20">When</th>
              <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Title</th>
              <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase">Acceptance</th>
              <th className="text-left py-2 px-2 text-[10px] font-bold text-slate-400 uppercase w-20">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 px-2 font-mono font-bold text-blue-600">{m.id}</td>
                <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{m.week}</td>
                <td className="py-2 px-2 text-slate-700 font-medium">{m.title}</td>
                <td className="py-2 px-2 text-slate-500 text-[12px]">{m.acceptance}</td>
                <td className="py-2 px-2">
                  <StatusChip status={m.status ?? 'pending'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-600',
    in_progress: 'bg-blue-100 text-blue-700',
    done: 'bg-emerald-100 text-emerald-700',
    overdue: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  )
}

// ── Risks (Accordion) ───────────────────────────────────
function RisksAccordion({ section }: { section: OverviewSection }) {
  const items = (section.items ?? []) as { risk?: string; mitigation?: string }[]
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <Card type="risks" heading={section.heading}>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-red-50/50 transition-colors text-left"
            >
              <span className="text-sm text-slate-700 flex items-center gap-2">
                <AlertTriangle size={13} className="text-red-400 shrink-0" />
                {item.risk}
              </span>
              {openIdx === i ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            </button>
            {openIdx === i && item.mitigation && (
              <div className="px-4 py-2.5 text-sm text-emerald-700 bg-emerald-50/50 border-t border-slate-100">
                <span className="font-semibold">Mitigation:</span> {item.mitigation}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Literature Entry Points ─────────────────────────────
function LiteratureCard({ section }: { section: OverviewSection }) {
  const items = (section.items ?? []) as { label?: string; value?: string }[]
  return (
    <Card type="literature" heading={section.heading}>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 text-sm">
            <span className="font-semibold text-purple-700 shrink-0 min-w-[120px]">{item.label}:</span>
            <span className="text-slate-600">{item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Next Actions (Checkboxes) ───────────────────────────
function ActionsCard({ section }: { section: OverviewSection }) {
  const items = (section.items ?? []) as { text?: string; done?: boolean }[]
  return (
    <Card type="actions" heading={section.heading}>
      <div className="space-y-1.5">
        {items.map((a, i) => (
          <div key={i} className="flex items-center gap-2.5 py-1">
            {a.done
              ? <CheckSquare size={16} className="text-emerald-500 shrink-0" />
              : <Square size={16} className="text-slate-300 shrink-0" />
            }
            <span className={`text-sm ${a.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{a.text}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Generic fallback ────────────────────────────────────
function GenericCard({ section }: { section: OverviewSection }) {
  return (
    <Card type="text" heading={section.heading}>
      <p className="text-sm text-slate-600 whitespace-pre-wrap">{safeText(section.raw || section.content || '')}</p>
    </Card>
  )
}

// ── Loading / Empty ─────────────────────────────────────
function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="lp-panel p-5 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/4 mb-3" />
          <div className="space-y-2">
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyOverview() {
  return (
    <div className="lp-panel p-8 text-center">
      <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
      <p className="text-slate-600 font-medium">No overview yet</p>
      <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
        Upload a filled template to generate a structured overview, or import literature to get started.
        Use the <strong>Download Template</strong> button above, fill it with any LLM, then <strong>Upload Filled Template</strong>.
      </p>
    </div>
  )
}
