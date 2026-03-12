import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  searchPapers, importCsvGlobal, fetchLiteratureStats,
  type PaperMeta,
} from '../api'
import { useState, useRef } from 'react'
import {
  Search, Upload, BookOpen, ExternalLink, Star, Loader2,
  FileText, Database, Clock, BarChart3, Globe,
} from 'lucide-react'

export default function LiteraturePage() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number; errors: number } | null>(null)

  const { data: stats } = useQuery({
    queryKey: ['literature-stats'],
    queryFn: fetchLiteratureStats,
  })

  const { data: papers, isLoading } = useQuery({
    queryKey: ['papers', searchTerm],
    queryFn: () => searchPapers(searchTerm),
  })

  const importMut = useMutation({
    mutationFn: (file: File) => importCsvGlobal(file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['papers'] })
      queryClient.invalidateQueries({ queryKey: ['literature-stats'] })
      setImportResult(result)
    },
  })

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImportResult(null)
      importMut.mutate(file)
    }
    e.target.value = ''
  }

  const handleSearch = () => setSearchTerm(query)

  return (
    <div>
      {/* Header — consistent with Dashboard */}
      <div className="lp-panel px-5 py-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-bold text-slate-900 tracking-tight">Literature Library</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Import, search, and organize research papers across all projects
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <a
            href="https://app.undermind.ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            <Globe size={14} />
            Get CSV from Undermind
          </a>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importMut.isPending}
            className="btn-primary"
          >
            {importMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {importMut.isPending ? 'Importing...' : 'Import CSV'}
          </button>
        </div>
      </div>

      {/* Import result feedback */}
      {importResult && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-[10px] flex items-center justify-between">
          <span className="text-sm text-emerald-800">
            <strong>{importResult.imported}</strong> imported · <strong>{importResult.duplicates}</strong> duplicates · <strong>{importResult.errors}</strong> errors
          </span>
          <button onClick={() => setImportResult(null)} className="text-emerald-600 text-sm font-medium hover:underline">Dismiss</button>
        </div>
      )}
      {importMut.isError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[10px] text-sm text-red-700">
          Import failed: {importMut.error?.message}
        </div>
      )}

      {/* Stats row */}
      <div className="lp-panel p-0 mb-6 overflow-hidden">
        <div className="flex divide-x divide-slate-200">
          <StatCell icon={<FileText size={14} />} label="Total Papers" value={stats?.total_papers ?? 0} />
          <StatCell icon={<BarChart3 size={14} />} label="Citations" value={stats?.citations_total ?? 'N/A'} />
          <StatCell icon={<Database size={14} />} label="Sources" value={stats?.sources_count ?? 0} />
          <StatCell icon={<Clock size={14} />} label="Last Import" value={stats?.last_import ? new Date(stats.last_import).toLocaleDateString() : 'Never'} />
          <StatCell icon={<BookOpen size={14} />} label="Projects" value={stats?.top_projects?.length ?? 0} />
        </div>
      </div>

      {/* Top projects by paper count */}
      {stats?.top_projects && stats.top_projects.length > 0 && (
        <div className="lp-panel px-4 py-3 mb-6">
          <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Top Projects by Paper Count</h3>
          <div className="flex flex-wrap gap-1.5">
            {stats.top_projects.map(tp => (
              <span key={tp.id} className="lp-chip lp-chip-indigo">
                {tp.id} <span className="font-bold">{tp.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="flex gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search papers by title, authors, abstract..."
            className="w-full text-[13px] pl-9 pr-4 py-2.5 border border-slate-200 rounded-[10px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          />
        </div>
        <button onClick={handleSearch} className="btn-primary">
          Search
        </button>
      </div>

      {/* Tag filter chips */}
      <TagFilterBar papers={papers} onTagClick={(t) => { setQuery(t); setSearchTerm(t) }} activeTag={searchTerm} />

      {/* Paper list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="lp-panel p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : !papers?.length ? (
        <div className="lp-panel p-12 text-center">
          <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">No papers found</p>
          <p className="text-sm text-slate-400 mt-1">
            Import papers from CSV or use{' '}
            <a href="https://app.undermind.ai/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Undermind</a>
            {' '}to find relevant literature.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {papers.map((p) => (
            <PaperCard key={p.paper_id} paper={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function TagFilterBar({ papers, onTagClick, activeTag }: { papers?: PaperMeta[]; onTagClick: (tag: string) => void; activeTag: string }) {
  const tagCounts = new Map<string, number>()
  papers?.forEach(p => p.tags?.forEach((t: string) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)))
  const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  if (sorted.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mb-5">
      <button
        onClick={() => onTagClick('')}
        className={`lp-chip transition-colors cursor-pointer ${!activeTag ? 'lp-chip-indigo' : 'lp-chip-slate hover:border-slate-300'}`}
      >All</button>
      {sorted.map(([tag, count]) => (
        <button
          key={tag}
          onClick={() => onTagClick(activeTag === tag ? '' : tag)}
          className={`lp-chip transition-colors cursor-pointer ${activeTag === tag ? 'lp-chip-indigo' : 'lp-chip-slate hover:border-slate-300'}`}
        >
          {tag} <span className="opacity-60">{count}</span>
        </button>
      ))}
    </div>
  )
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex-1 px-4 py-3">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
      <div className="text-lg font-bold text-slate-900">{value}</div>
    </div>
  )
}

function PaperCard({ paper: p }: { paper: PaperMeta }) {
  const [expanded, setExpanded] = useState(false)
  const displayTags = p.tags?.length ? p.tags.slice(0, 3) : ['untagged']

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Meta row: year, score, pinned */}
            <div className="flex items-center gap-1.5 mb-1">
              {p.pinned && <Star size={11} className="text-amber-500 fill-amber-500" />}
              {p.year && <span className="lp-chip lp-chip-slate">{p.year}</span>}
              {p.topic_match_score != null && (
                <span className="lp-chip lp-chip-indigo">Score: {p.topic_match_score}</span>
              )}
              {/* Always show 1-3 tags */}
              {displayTags.map((t) => (
                <span key={t} className={`lp-chip ${t === 'untagged' ? 'lp-chip-slate' : 'lp-chip-purple'}`}>{t}</span>
              ))}
            </div>
            <button onClick={() => setExpanded(!expanded)} className="text-left w-full">
              <h3 className="text-[13px] font-semibold text-slate-900 hover:text-indigo-700 transition-colors leading-snug">
                {p.title}
              </h3>
            </button>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{p.authors}</p>
            {p.journal && <p className="text-[10px] text-slate-400 mt-0.5 italic">{p.journal}</p>}

            {expanded && (
              <div className="mt-3 space-y-2">
                {p.abstract && (
                  <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-[10px]">
                    {p.abstract.substring(0, 500)}{p.abstract.length > 500 ? '...' : ''}
                  </p>
                )}
                {p.relevance_summary && (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    <strong>Relevance:</strong> {p.relevance_summary.substring(0, 300)}
                  </p>
                )}
                <div className="flex gap-1.5 flex-wrap">
                  {p.tags.map((t) => (
                    <span key={t} className="lp-chip lp-chip-purple">{t}</span>
                  ))}
                  {p.projects.map((pr) => (
                    <span key={pr} className="lp-chip lp-chip-indigo">{pr}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {p.citation_count != null && (
              <span className="text-[10px] text-slate-400 font-mono">{p.citation_count} cit.</span>
            )}
            {p.link && (
              <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600">
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
