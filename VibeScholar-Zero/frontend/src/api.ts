const BASE = '/api/v1';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// ── Projects ────────────────────────────────────────────
export interface ProjectSummary {
  id: string;
  name: string;
  name_en: string;
  definition: string;
  pillar: string;
  tags: string[];
  priority: string;
  rag: string;
  vc_progress: number;
  vr_progress: number;
  literature_count: number;
  literature_tags: string[];
  blockers_count: number;
  overdue_count: number;
  last_activity: string | null;
  vc_current_step: string | null;
  vr_current_step: string | null;
  template_imported_at: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  overview_md: string;
  modules: string[];
}

export const fetchProjects = () => request<ProjectSummary[]>('/projects');
export const fetchProject = (id: string) => request<ProjectDetail>(`/projects/${id}`);
export const patchProject = (id: string, data: Record<string, unknown>) =>
  request<ProjectSummary>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteProject = (id: string) =>
  request<{ status: string; project_id: string; deleted: boolean }>(`/projects/${id}`, { method: 'DELETE' });
export const patchProjectMeta = (id: string, data: { name?: string; name_en?: string; definition?: string; pillar?: string; tags?: string[] }) =>
  request<ProjectSummary>(`/projects/${id}/meta`, { method: 'PATCH', body: JSON.stringify(data) });

// ── Overview ────────────────────────────────────────────
export const fetchOverview = (id: string) => request<{ content: string }>(`/projects/${id}/content/overview`);
export const saveOverview = (id: string, content: string) =>
  request(`/projects/${id}/content/overview`, { method: 'PUT', body: JSON.stringify({ content }) });

// ── Structured Overview ─────────────────────────────────
export interface OverviewSection {
  heading: string;
  type: string;
  raw?: string;
  content?: string;
  context?: string[];
  impact?: string[];
  in_scope?: string[];
  out_scope?: string[];
  items?: Record<string, unknown>[];
  steps?: Record<string, unknown>[];
}

export interface StructuredOverview {
  title: string;
  sections: OverviewSection[];
}

export const fetchOverviewStructured = (id: string) =>
  request<StructuredOverview>(`/projects/${id}/content/overview_structured`);
export const saveOverviewStructured = (id: string, data: StructuredOverview) =>
  request(`/projects/${id}/content/overview_structured`, { method: 'PUT', body: JSON.stringify(data) });

// ── Execution Steps ─────────────────────────────────────
export interface ExecutionStep {
  id: string;
  title: string;
  description: string;
  acceptance: string;
  section: string;
  linked_milestone: string;
  status: string; // todo | doing | done | blocked
  prompt_hint: string;
}

export const fetchExecutionSteps = (projectId: string, type: string) =>
  request<{ steps: ExecutionStep[] }>(`/projects/${projectId}/execution/${type}`);
export const updateExecutionStep = (projectId: string, type: string, stepId: string, update: Record<string, unknown>) =>
  request<ExecutionStep>(`/projects/${projectId}/execution/${type}/steps/${stepId}`, { method: 'PATCH', body: JSON.stringify(update) });
export const reorderExecutionSteps = (projectId: string, type: string, fromIndex: number, toIndex: number) =>
  request(`/projects/${projectId}/execution/${type}/reorder`, { method: 'POST', body: JSON.stringify({ from_index: fromIndex, to_index: toIndex }) });
export const reorderExecutionStepsByIds = (projectId: string, type: string, orderedIds: string[]) =>
  request(`/projects/${projectId}/execution/${type}/reorder`, { method: 'POST', body: JSON.stringify({ ordered_ids: orderedIds }) });
export const generateExecution = (projectId: string) =>
  request<{ status: string; vc_steps_count: number; vr_steps_count: number }>(`/projects/${projectId}/execution/generate`, { method: 'POST' });
export const addExecutionStep = (projectId: string, type: string, body: { after_id?: string; title?: string; section?: string }) =>
  request<ExecutionStep>(`/projects/${projectId}/execution/${type}/step/add`, { method: 'POST', body: JSON.stringify(body) });
export const deleteExecutionStep = (projectId: string, type: string, stepId: string) =>
  request<{ status: string; deleted: string; remaining: number }>(`/projects/${projectId}/execution/${type}/step/delete`, { method: 'POST', body: JSON.stringify({ step_id: stepId }) });

// ── Checklists ──────────────────────────────────────────
export interface ChecklistItem {
  id: string;
  section: string;
  text: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string | null;
}

export interface Checklist {
  items: ChecklistItem[];
}

export const fetchChecklist = (projectId: string, type: string) =>
  request<Checklist>(`/projects/${projectId}/checklists/${type}`);
export const saveChecklist = (projectId: string, type: string, checklist: Checklist) =>
  request<Checklist>(`/projects/${projectId}/checklists/${type}`, { method: 'PUT', body: JSON.stringify(checklist) });
export const addChecklistItem = (projectId: string, type: string, item: { text: string; section?: string; status?: string }) =>
  request<ChecklistItem>(`/projects/${projectId}/checklists/${type}/items`, { method: 'POST', body: JSON.stringify(item) });
export const updateChecklistItem = (projectId: string, type: string, itemId: string, update: Record<string, unknown>) =>
  request<ChecklistItem>(`/projects/${projectId}/checklists/${type}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(update) });

// ── Logs ────────────────────────────────────────────────
export interface LogEntry {
  timestamp: string;
  type: string;
  summary: string;
  details: string;
  duration_min: number | null;
  checklist_item_id: string | null;
}

export const fetchLogs = (projectId: string, type: string, limit = 50) =>
  request<LogEntry[]>(`/projects/${projectId}/logs/${type}?limit=${limit}`);
export const addLog = (projectId: string, type: string, entry: { type: string; summary: string; details?: string; duration_min?: number }) =>
  request<LogEntry>(`/projects/${projectId}/logs/${type}`, { method: 'POST', body: JSON.stringify(entry) });

// ── Artifacts ───────────────────────────────────────────
export interface Artifact {
  id: string;
  type: string;
  name: string;
  path: string;
  description: string;
  linked_milestone: string;
  created_at: string;
}

export const fetchArtifacts = (projectId: string) => request<Artifact[]>(`/projects/${projectId}/artifacts`);
export const addArtifact = (projectId: string, item: { type: string; name: string; path?: string; description?: string; linked_milestone?: string }) =>
  request<Artifact>(`/projects/${projectId}/artifacts`, { method: 'POST', body: JSON.stringify(item) });

// ── Milestones ──────────────────────────────────────────
export interface MilestoneItem {
  id: string;
  title: string;
  deadline: string;
  status: string;
  acceptance: string;
  owner: string;
}

export const fetchMilestones = (projectId: string) =>
  request<MilestoneItem[]>(`/projects/${projectId}/milestones`);
export const addMilestone = (projectId: string, data: Record<string, unknown>) =>
  request<MilestoneItem>(`/projects/${projectId}/milestones`, { method: 'POST', body: JSON.stringify(data) });
export const updateMilestone = (projectId: string, milestoneId: string, update: Record<string, unknown>) =>
  request(`/projects/${projectId}/milestones/${milestoneId}`, { method: 'PATCH', body: JSON.stringify(update) });
export const reorderMilestones = (projectId: string, fromIndex: number, toIndex: number) =>
  request(`/projects/${projectId}/milestones/reorder`, { method: 'POST', body: JSON.stringify({ from_index: fromIndex, to_index: toIndex }) });
export const reorderMilestonesByIds = (projectId: string, orderedIds: string[]) =>
  request(`/projects/${projectId}/milestones/reorder`, { method: 'POST', body: JSON.stringify({ ordered_ids: orderedIds }) });

// ── Kanban ──────────────────────────────────────────────
export interface KanbanItem {
  id: string;
  title: string;
  column: string;
  description: string;
  linked_milestone: string;
}

export const fetchKanban = (projectId: string) =>
  request<KanbanItem[]>(`/projects/${projectId}/kanban`);
export const updateKanbanItem = (projectId: string, itemId: string, update: Record<string, unknown>) =>
  request(`/projects/${projectId}/kanban/${itemId}`, { method: 'PATCH', body: JSON.stringify(update) });
export const addKanbanItem = (projectId: string, item: Record<string, unknown>) =>
  request<KanbanItem>(`/projects/${projectId}/kanban`, { method: 'POST', body: JSON.stringify(item) });

export const generateTimeline = (projectId: string) =>
  request<{ status: string; milestones_count: number; kanban_count: number }>(`/projects/${projectId}/timeline/generate`, { method: 'POST' });

// ── Literature ──────────────────────────────────────────
export const importProjectCsv = async (projectId: string, file: File, csvFormat: string = 'auto'): Promise<LiteratureImportResult> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('csv_format', csvFormat);
  const res = await fetch(`${BASE}/literature/projects/${projectId}/import_csv`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Import failed: ${res.status}`);
  return res.json();
};

export const fetchProjectPapers = (projectId: string, query = '', tag = '') =>
  request<PaperMeta[]>(`/literature/projects/${projectId}/papers?query=${encodeURIComponent(query)}&tag=${encodeURIComponent(tag)}`);

export interface LiteratureImportResult {
  total: number;
  imported: number;
  duplicates: number;
  errors: number;
}

export interface PaperMeta {
  paper_id: string;
  title: string;
  authors: string;
  year: number | null;
  journal: string;
  citation_count: number | null;
  doi: string;
  link: string;
  abstract: string;
  relevance_summary: string;
  topic_match_score: number | null;
  tags: string[];
  projects: string[];
  pinned: boolean;
}

export interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  errors: number;
}

export const importLiterature = () => request<ImportResult>('/literature/import', { method: 'POST' });

export interface LiteratureStats {
  total_papers: number;
  citations_total: number | null;
  sources_count: number;
  last_import: string | null;
  top_projects: { id: string; count: number }[];
}

export const fetchLiteratureStats = () => request<LiteratureStats>('/literature/stats');

export const importCsvGlobal = async (file: File): Promise<LiteratureImportResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/literature/import_csv`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Import failed: ${res.status}`);
  return res.json();
};
export const searchPapers = (query = '', project = '', limit = 50) =>
  request<PaperMeta[]>(`/literature/papers?query=${encodeURIComponent(query)}&project=${encodeURIComponent(project)}&limit=${limit}`);
export const fetchPaperNotes = (paperId: string) => request<{ content: string }>(`/literature/papers/${paperId}/notes`);
export const savePaperNotes = (paperId: string, content: string) =>
  request(`/literature/papers/${paperId}/notes`, { method: 'PUT', body: JSON.stringify({ content }) });
export const savePaperTags = (paperId: string, data: { tags?: string[]; projects?: string[]; pinned?: boolean }) =>
  request(`/literature/papers/${paperId}/tags`, { method: 'PUT', body: JSON.stringify(data) });

// ── Reports ─────────────────────────────────────────────
export interface ReportResult {
  path: string;
  content: string;
}

export const generateDaily = (date?: string) =>
  request<ReportResult>('/reports/daily', { method: 'POST', body: JSON.stringify({ date }) });
export const generateWeekly = (date?: string) =>
  request<ReportResult>('/reports/weekly', { method: 'POST', body: JSON.stringify({ date }) });

export interface ReportList {
  daily: string[];
  weekly: string[];
}

export const fetchReportList = () => request<ReportList>('/reports/list');
export interface ReportDetail {
  content: string;
  summary: ActivitySummary;
  events: ActivityEvent[];
}

export const fetchDailyReport = (date: string) => request<ReportDetail>(`/reports/daily/${date}`);
export const fetchWeeklyReport = (week: string) => request<ReportDetail>(`/reports/weekly/${week}`);

// ── Events & Activity ──────────────────────────────────
export interface ActivityEvent {
  ts: string;
  project_id: string;
  kind: string;
  action: string;
  summary: string;
  ref: Record<string, unknown>;
}

export interface ActivitySummary {
  total: number;
  by_kind: Record<string, number>;
  by_action: Record<string, number>;
  by_project: Record<string, number>;
  date?: string;
  week?: string;
}

export const fetchRecentEvents = (limit = 20) =>
  request<ActivityEvent[]>(`/reports/events?limit=${limit}`);
export const fetchTodaySummary = () =>
  request<ActivitySummary>('/reports/today_summary');
export const fetchWeekSummary = () =>
  request<ActivitySummary>('/reports/week_summary');

// ── Health ──────────────────────────────────────────────
export const fetchHealth = () => request<{ status: string; version: string }>('/health');

// ── Maintenance ─────────────────────────────────────────
export const reindexLiterature = () =>
  request<{ status: string; papers_indexed: number }>('/maintenance/reindex-literature', { method: 'POST' });
export const rebuildCache = () =>
  request<{ status: string; projects: Record<string, string> }>('/maintenance/rebuild-cache', { method: 'POST' });
export const exportSummary = () =>
  request<{ projects: Array<Record<string, unknown>>; total_papers: number }>('/maintenance/export-summary');

// ── Core Description ───────────────────────────────────
export interface CoreDescription {
  text: string;
  updated_at: string | null;
}

export const fetchCoreDescription = (projectId: string) =>
  request<CoreDescription>(`/projects/${projectId}/core_description`);
export const saveCoreDescription = (projectId: string, text: string) =>
  request<CoreDescription>(`/projects/${projectId}/core_description`, { method: 'PUT', body: JSON.stringify({ text }) });

// ── Templates ──────────────────────────────────────────
export const downloadTemplate = async (): Promise<string> => {
  const res = await fetch(`${BASE}/templates/project_content`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
};

export const importTemplate = (projectId: string, template: Record<string, unknown>) =>
  request<{ status: string; project_id: string; generated: Record<string, unknown> }>(
    `/projects/${projectId}/import_template`,
    { method: 'POST', body: JSON.stringify(template) },
  );

export const checkTemplateImported = async (projectId: string): Promise<boolean> => {
  try {
    const res = await fetch(`${BASE}/projects/${projectId}`);
    if (!res.ok) return false;
    const data = await res.json();
    // Check if overview_md has real content (not just the skeleton)
    return data.overview_md && data.overview_md.length > 100;
  } catch {
    return false;
  }
};

// ── Quick Add Project ───────────────────────────────────
export const importProject = (template: Record<string, unknown>) =>
  request<{ status: string; project_id: string; generated: Record<string, unknown> }>('/projects/import', { method: 'POST', body: JSON.stringify(template) });

// ── DesignSpec / Literature Toolkit ─────────────────────
export const exportLiteratureCsv = (projectId: string) =>
  `${BASE}/projects/${projectId}/literature/export_full_csv`;
export const downloadReviewPrompt = (projectId: string) =>
  `${BASE}/projects/${projectId}/literature/prompts/review_prompt`;
export const downloadDesignspecPrompt = (projectId: string) =>
  `${BASE}/projects/${projectId}/literature/prompts/designspec_prompt`;
export const downloadVcPrompt = (projectId: string) =>
  `${BASE}/projects/${projectId}/prompts/vibe_coding`;
export const downloadVrPrompt = (projectId: string) =>
  `${BASE}/projects/${projectId}/prompts/vibe_research`;

export interface DesignSpecImportResult {
  status: string;
  backup_path: string;
  summary: {
    overview_sections_updated: number;
    vibe_coding_steps: { before: number; after: number };
    vibe_research_steps: { before: number; after: number };
    milestones: { before: number; after: number };
    artifacts: { before: number; after: number };
  };
}

export const importDesignSpec = async (projectId: string, file: File): Promise<DesignSpecImportResult> => {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/projects/${projectId}/designspec/import`, { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ? (typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)) : `${res.status} ${res.statusText}`);
  }
  return res.json();
};

export interface DesignSpecStatus {
  exists: boolean;
  schema_version?: number;
  topic?: string;
  modules_count?: number;
  baselines_count?: number;
  datasets_count?: number;
}

export const fetchDesignSpecStatus = (projectId: string) =>
  request<DesignSpecStatus>(`/projects/${projectId}/designspec/status`);

export interface DesignSpecStepContext {
  exists: boolean;
  step_found?: boolean;
  prompt_short?: string;
  prompt_expanded?: string;
  designspec_refs?: string[];
  context?: string;
}

export const fetchDesignSpecStepContext = (projectId: string, stepId: string) =>
  request<DesignSpecStepContext>(`/projects/${projectId}/designspec/step_context/${stepId}`);
