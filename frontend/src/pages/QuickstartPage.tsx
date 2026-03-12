import { Link } from 'react-router-dom'
import {
  Zap, BookOpen, FlaskConical, Package, Clock,
  ArrowRight, Download, Upload, Plus, BarChart3, ExternalLink,
  CheckCircle2, Sparkles, Layers, GitBranch,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Layers,
    title: 'Project Dashboard',
    desc: 'Track all research projects with priority, RAG status, and dual progress bars for Vibe Coding and Vibe Research.',
    color: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: FlaskConical,
    title: 'Structured Overview',
    desc: 'Auto-generate a rich structured overview from your template: definitions, milestones, pipeline, risks, and more.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Zap,
    title: 'Execution Steps',
    desc: 'Structured VC/VR execution steps with status cycling (todo → doing → done → blocked). Inline editing for all fields.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: BookOpen,
    title: 'Literature Manager',
    desc: 'Import papers via CSV, search and tag, track citation counts. Direct link to Undermind for AI-powered paper discovery.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: Clock,
    title: 'Timeline & Kanban',
    desc: 'Milestones with deadline tracking, status cycling, and acceptance criteria. Kanban board with drag-to-advance cards.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: Package,
    title: 'Artifacts Registry',
    desc: 'Track code repos, datasets, papers, demos, and reports. Color-coded type badges with linked milestones.',
    color: 'bg-rose-50 text-rose-600',
  },
]

const WORKFLOW_STEPS = [
  {
    step: '1',
    title: 'Create a Project',
    desc: 'Use the "+ New Project" button on the Home page. Fill in name, definition, pillar, and priority.',
    icon: Plus,
  },
  {
    step: '2',
    title: 'Fill the Template',
    desc: 'Download the YAML template from the project page, fill it with AI (GPT/Gemini), then upload the filled JSON.',
    icon: Download,
  },
  {
    step: '3',
    title: 'Generate Content',
    desc: 'The system auto-generates a structured overview, execution steps, milestones, and kanban items.',
    icon: Sparkles,
  },
  {
    step: '4',
    title: 'Execute & Track',
    desc: 'Cycle step statuses, log progress, import literature, and track artifacts as you work.',
    icon: Zap,
  },
]

export default function QuickstartPage() {
  return (
    <div className="space-y-10 max-w-4xl">
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-[18px] p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/15 backdrop-blur rounded-[10px] flex items-center justify-center">
              <GitBranch size={20} className="text-white" />
            </div>
            <span className="text-[13px] font-medium text-white/70 uppercase tracking-wider">VibeScholar</span>
          </div>
          <h1 className="text-3xl font-black leading-tight mb-3">Quickstart Guide</h1>
          <p className="text-[15px] text-white/80 leading-relaxed max-w-2xl">
            VibeScholar is a human-in-the-loop research operations console built for the <strong>Vibe Coding + Vibe Research</strong> workflow.
            Plan fast, monitor continuously, and refine in real time — from idea to literature to implementation.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-700 font-semibold text-[13px] rounded-[10px] hover:bg-white/90 transition-colors"
            >
              Go to Dashboard <ArrowRight size={14} />
            </Link>
            <a
              href="https://app.undermind.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-medium text-[13px] rounded-[10px] hover:bg-white/20 transition-colors border border-white/20"
            >
              Undermind <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Workflow Steps */}
      <section>
        <h2 className="text-lg font-black text-slate-900 mb-1">Getting Started</h2>
        <p className="text-[13px] text-slate-500 mb-5">Four steps to go from zero to a fully managed research project.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {WORKFLOW_STEPS.map((ws) => (
            <div key={ws.step} className="lp-panel p-5 flex gap-4 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 bg-indigo-50 rounded-[10px] flex items-center justify-center shrink-0">
                <ws.icon size={18} className="text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">STEP {ws.step}</span>
                  <span className="text-[14px] font-semibold text-slate-800">{ws.title}</span>
                </div>
                <p className="text-[12px] text-slate-500 leading-relaxed">{ws.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section>
        <h2 className="text-lg font-black text-slate-900 mb-1">Features</h2>
        <p className="text-[13px] text-slate-500 mb-5">Everything you need to manage research projects end-to-end.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="lp-panel p-5 hover:shadow-sm transition-shadow">
              <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center mb-3 ${f.color}`}>
                <f.icon size={18} />
              </div>
              <h3 className="text-[14px] font-semibold text-slate-800 mb-1">{f.title}</h3>
              <p className="text-[12px] text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Template Workflow */}
      <section>
        <h2 className="text-lg font-black text-slate-900 mb-1">AI Template Workflow</h2>
        <p className="text-[13px] text-slate-500 mb-5">Use AI to rapidly fill project content templates.</p>
        <div className="lp-panel p-6">
          <div className="flex items-start gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-amber-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Download size={14} className="text-amber-600" />
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-slate-800">1. Download Template</h4>
                  <p className="text-[12px] text-slate-500">Get the YAML template from any project's header banner (shows when content is missing).</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-purple-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={14} className="text-purple-600" />
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-slate-800">2. Fill with AI</h4>
                  <p className="text-[12px] text-slate-500">Paste the template into GPT-4, Gemini, or Claude. Ask it to fill all sections based on your project idea. Save as JSON.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-emerald-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Upload size={14} className="text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-slate-800">3. Upload & Generate</h4>
                  <p className="text-[12px] text-slate-500">Upload the JSON file. The system generates a structured overview, execution steps, milestones, and kanban items automatically.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-blue-50 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 size={14} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="text-[13px] font-semibold text-slate-800">4. Refine & Execute</h4>
                  <p className="text-[12px] text-slate-500">Edit any generated content inline. Start cycling step statuses and logging progress.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Keyboard Shortcuts / Tips */}
      <section>
        <h2 className="text-lg font-black text-slate-900 mb-1">Pro Tips</h2>
        <p className="text-[13px] text-slate-500 mb-5">Useful tips for efficient workflow.</p>
        <div className="lp-panel overflow-hidden">
          {[
            { tip: 'Click status badges to cycle through states', context: 'Steps: todo → doing → done → blocked. Milestones: pending → in_progress → done → overdue.' },
            { tip: 'Hover over any item to reveal the Edit button', context: 'Works on execution steps, milestones, and kanban cards.' },
            { tip: 'Use the template import to generate content', context: 'Download the template, fill it with any LLM, then upload to auto-generate everything.' },
            { tip: 'Import CSV from Google Scholar or Semantic Scholar', context: 'The literature importer auto-detects column mappings for title, authors, year, venue, DOI.' },
            { tip: 'Projects auto-group by pillar in the sidebar', context: 'Define pillars like "P1: NLP", "P2: Vision" to organize projects.' },
          ].map((t, i) => (
            <div key={i} className={`flex items-start gap-3 px-5 py-3.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
              <BarChart3 size={14} className="text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <div className="text-[13px] font-medium text-slate-700">{t.tip}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{t.context}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <div className="text-center py-6">
        <p className="text-[13px] text-slate-400 mb-3">Ready to get started?</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold text-[13px] rounded-[10px] hover:bg-indigo-700 transition-colors"
        >
          Open Dashboard <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}
