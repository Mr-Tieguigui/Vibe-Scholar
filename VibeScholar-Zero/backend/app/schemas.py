"""Pydantic V2 schemas for VibeScholar API."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Project ──────────────────────────────────────────────
class ProjectSummary(BaseModel):
    id: str
    name: str
    name_en: str = ""
    definition: str = ""
    pillar: str = ""
    tags: list[str] = []
    priority: str = "P2"
    rag: str = "green"  # red / amber / green
    vc_progress: float = 0.0
    vr_progress: float = 0.0
    literature_count: int = 0
    literature_tags: list[str] = []
    blockers_count: int = 0
    overdue_count: int = 0
    last_activity: Optional[str] = None
    vc_current_step: Optional[str] = None
    vr_current_step: Optional[str] = None
    template_imported_at: Optional[str] = None


class ProjectDetail(ProjectSummary):
    overview_md: str = ""
    modules: list[str] = []


class ProjectPatch(BaseModel):
    rag: Optional[str] = None
    tags: Optional[list[str]] = None
    priority: Optional[str] = None


class ProjectMetaPatch(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    definition: Optional[str] = None
    pillar: Optional[str] = None
    tags: Optional[list[str]] = None


# ── Checklists ───────────────────────────────────────────
class ChecklistItem(BaseModel):
    id: str
    section: str = "default"
    text: str
    status: str = "todo"  # todo / doing / done / blocked
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: Optional[str] = None


class Checklist(BaseModel):
    items: list[ChecklistItem] = []


class ChecklistItemCreate(BaseModel):
    section: str = "default"
    text: str
    status: str = "todo"
    notes: str = ""


class ChecklistItemUpdate(BaseModel):
    text: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    section: Optional[str] = None


# ── Logs ─────────────────────────────────────────────────
class LogEntry(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    type: str = "progress"  # progress / session / note / blocker
    summary: str = ""
    details: str = ""
    duration_min: Optional[int] = None
    checklist_item_id: Optional[str] = None


class LogEntryCreate(BaseModel):
    type: str = "progress"
    summary: str
    details: str = ""
    duration_min: Optional[int] = None
    checklist_item_id: Optional[str] = None


# ── Artifacts ────────────────────────────────────────────
class Artifact(BaseModel):
    id: str
    type: str  # code / dataset / paper / demo / report / other
    name: str
    path: str = ""
    description: str = ""
    linked_milestone: str = ""
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class ArtifactCreate(BaseModel):
    type: str
    name: str
    path: str = ""
    description: str = ""
    linked_milestone: str = ""


# ── Literature ───────────────────────────────────────────
class PaperMeta(BaseModel):
    paper_id: str
    title: str = ""
    authors: str = ""
    year: Optional[int] = None
    date: str = ""
    journal: str = ""
    citation_count: Optional[int] = None
    doi: str = ""
    link: str = ""
    is_open_access: bool = False
    open_access_link: str = ""
    semantic_scholar_id: str = ""
    abstract: str = ""
    relevance_summary: str = ""
    topic_match_score: Optional[float] = None
    tags: list[str] = []
    projects: list[str] = []
    pinned: bool = False


class PaperNotes(BaseModel):
    content: str = ""


class LiteratureImportResult(BaseModel):
    total: int = 0
    imported: int = 0
    duplicates: int = 0
    errors: int = 0


# ── Reports ──────────────────────────────────────────────
class ReportGenRequest(BaseModel):
    date: Optional[str] = None  # YYYY-MM-DD or YYYY-Wxx


class ReportGenResult(BaseModel):
    path: str
    content: str


# ── Milestones ───────────────────────────────────────────
class Milestone(BaseModel):
    id: str
    title: str
    deadline: str = ""
    status: str = "pending"  # pending / in_progress / done / overdue
    acceptance: str = ""
    owner: str = ""


# ── Kanban ───────────────────────────────────────────────
class KanbanItem(BaseModel):
    id: str
    title: str
    column: str = "backlog"  # backlog / doing / done
    description: str = ""
    linked_milestone: str = ""


# ── Health ───────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.2.0"
    app: str = "VibeScholar"
