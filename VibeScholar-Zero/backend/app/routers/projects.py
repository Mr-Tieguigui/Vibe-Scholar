"""Project CRUD router."""

from fastapi import APIRouter, HTTPException
from ..config import settings
from ..schemas import (
    ProjectSummary, ProjectDetail, ProjectPatch, ProjectMetaPatch,
    Checklist, ChecklistItem, ChecklistItemCreate, ChecklistItemUpdate,
    LogEntry, LogEntryCreate,
    Artifact, ArtifactCreate,
    Milestone, KanbanItem,
)
from ..utils import read_yaml, write_yaml, read_markdown, write_markdown, append_jsonl, read_jsonl, read_json, write_json
from ..overview_parser import parse_overview_md
from ..step_generator import generate_execution_steps
from ..events import emit_event
from datetime import datetime
import uuid

router = APIRouter(prefix="/projects", tags=["projects"])


def _load_projects_config() -> list[dict]:
    cfg = read_yaml(settings.config_dir / "projects.yaml")
    return cfg.get("projects", [])


def _ensure_project_scaffold(project_id: str):
    """Create minimal project directory scaffold if missing."""
    pdir = settings.projects_dir / project_id
    for sub in ["content", "checklists", "logs", "execution", "artifacts", "timeline", "literature/normalized", "literature/sources"]:
        (pdir / sub).mkdir(parents=True, exist_ok=True)
    # Ensure project.yaml exists
    proj_path = pdir / "project.yaml"
    if not proj_path.exists():
        write_yaml(proj_path, {"rag": "green", "priority": "P2", "tags": []})
    # Ensure overview.md exists
    ov_path = pdir / "content" / "overview.md"
    if not ov_path.exists():
        cfg = _load_projects_config()
        found = next((p for p in cfg if p["id"] == project_id), None)
        name = found.get("name", project_id) if found else project_id
        write_markdown(ov_path, f"# {name}\n")
    return pdir


def _project_dir(project_id: str):
    d = settings.projects_dir / project_id
    if not d.exists():
        raise HTTPException(404, f"Project {project_id} not found")
    return d


def _compute_progress(items: list[dict]) -> float:
    if not items:
        return 0.0
    done = sum(1 for i in items if i.get("status") == "done")
    return round(done / len(items) * 100, 1)


def _current_step(items: list[dict]) -> str | None:
    for i in items:
        if i.get("status") == "doing":
            return i.get("text", "")
    return None


def _blockers_count(items: list[dict]) -> int:
    return sum(1 for i in items if i.get("status") == "blocked")


def _literature_count(pdir) -> int:
    try:
        path = pdir / "literature" / "normalized" / "papers.jsonl"
        if not path.exists():
            return 0
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            return 0
        return sum(1 for line in text.split("\n") if line.strip())
    except Exception:
        return 0


def _literature_top_tags(pdir, limit: int = 5) -> list[str]:
    """Return the most frequent literature tags for a project."""
    try:
        import json
        path = pdir / "literature" / "normalized" / "papers.jsonl"
        if not path.exists():
            return []
        counts: dict[str, int] = {}
        for line in path.read_text(encoding="utf-8").strip().split("\n"):
            if not line.strip():
                continue
            paper = json.loads(line)
            for tag in paper.get("tags", []):
                if tag:
                    counts[tag] = counts.get(tag, 0) + 1
        return sorted(counts, key=counts.get, reverse=True)[:limit]
    except Exception:
        return []


def _overdue_count(pdir) -> int:
    try:
        data = read_yaml(pdir / "timeline" / "milestones.yaml")
        return sum(1 for m in data.get("milestones", []) if m.get("status") == "overdue")
    except Exception:
        return 0


def _build_summary(p: dict) -> ProjectSummary:
    pid = p["id"]
    pdir = settings.projects_dir / pid

    proj_yaml = read_yaml(pdir / "project.yaml") if pdir.exists() else {}
    vc_data = read_yaml(pdir / "checklists" / "vibe_coding.yaml") if pdir.exists() else {}
    vr_data = read_yaml(pdir / "checklists" / "vibe_research.yaml") if pdir.exists() else {}
    vc_items = vc_data.get("items", [])
    vr_items = vr_data.get("items", [])

    # Template import status
    tmpl_data = read_yaml(pdir / "template_imported.yaml") if pdir.exists() else {}
    tmpl_at = tmpl_data.get("timestamp") if tmpl_data.get("imported") else None

    return ProjectSummary(
        id=pid,
        name=p.get("name", ""),
        name_en=p.get("name_en", ""),
        definition=p.get("definition", ""),
        pillar=p.get("pillar", ""),
        tags=proj_yaml.get("tags", p.get("tags", [])),
        priority=proj_yaml.get("priority", p.get("priority", "P2")),
        rag=proj_yaml.get("rag", "green"),
        vc_progress=_compute_progress(vc_items),
        vr_progress=_compute_progress(vr_items),
        literature_count=_literature_count(pdir) if pdir.exists() else 0,
        literature_tags=_literature_top_tags(pdir) if pdir.exists() else [],
        blockers_count=_blockers_count(vc_items) + _blockers_count(vr_items),
        overdue_count=_overdue_count(pdir) if pdir.exists() else 0,
        last_activity=proj_yaml.get("last_activity"),
        vc_current_step=_current_step(vc_items),
        vr_current_step=_current_step(vr_items),
        template_imported_at=tmpl_at,
    )


# ── List projects ────────────────────────────────────────
@router.get("", response_model=list[ProjectSummary])
async def list_projects():
    projects = _load_projects_config()
    return [_build_summary(p) for p in projects]


# ── Get project detail ───────────────────────────────────
@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project(project_id: str):
    projects = _load_projects_config()
    found = next((p for p in projects if p["id"] == project_id), None)
    if not found:
        raise HTTPException(404, f"Project {project_id} not found in config")

    # Auto-scaffold if project is in config but dir missing
    pdir = settings.projects_dir / project_id
    if not pdir.exists():
        _ensure_project_scaffold(project_id)

    summary = _build_summary(found)
    overview = read_markdown(pdir / "content" / "overview.md") if pdir.exists() else ""

    return ProjectDetail(**summary.model_dump(), overview_md=overview)


# ── Delete project ───────────────────────────────────────
@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Remove a project from config and delete its data directory."""
    import shutil

    # Remove from projects.yaml
    cfg_path = settings.config_dir / "projects.yaml"
    cfg = read_yaml(cfg_path)
    projects = cfg.get("projects", [])
    new_projects = [p for p in projects if p.get("id") != project_id]
    if len(new_projects) == len(projects):
        raise HTTPException(404, f"Project {project_id} not found in config")
    cfg["projects"] = new_projects
    write_yaml(cfg_path, cfg)

    # Delete project directory
    pdir = settings.projects_dir / project_id
    if pdir.exists():
        shutil.rmtree(pdir)

    return {"status": "ok", "project_id": project_id, "deleted": True}


# ── Patch project ────────────────────────────────────────
@router.patch("/{project_id}", response_model=ProjectSummary)
async def patch_project(project_id: str, patch: ProjectPatch):
    pdir = _project_dir(project_id)
    proj_yaml_path = pdir / "project.yaml"
    data = read_yaml(proj_yaml_path)

    if patch.rag is not None:
        data["rag"] = patch.rag
    if patch.tags is not None:
        data["tags"] = patch.tags
    if patch.priority is not None:
        data["priority"] = patch.priority
    data["last_activity"] = datetime.utcnow().isoformat()
    write_yaml(proj_yaml_path, data)

    projects = _load_projects_config()
    found = next((p for p in projects if p["id"] == project_id), None)
    return _build_summary(found)


# ── Project Meta (canonical: config/projects.yaml) ────────
@router.patch("/{project_id}/meta", response_model=ProjectSummary)
async def patch_project_meta(project_id: str, patch: ProjectMetaPatch):
    """Update project metadata (name, definition, pillar, tags) in the canonical config."""
    cfg_path = settings.config_dir / "projects.yaml"
    cfg = read_yaml(cfg_path)
    projects = cfg.get("projects", [])
    found = None
    for p in projects:
        if p["id"] == project_id:
            found = p
            break
    if not found:
        raise HTTPException(404, f"Project {project_id} not found in config")

    if patch.name is not None:
        found["name"] = patch.name
    if patch.name_en is not None:
        found["name_en"] = patch.name_en
    if patch.definition is not None:
        found["definition"] = patch.definition
    if patch.pillar is not None:
        found["pillar"] = patch.pillar
    if patch.tags is not None:
        found["tags"] = patch.tags

    write_yaml(cfg_path, {"projects": projects})
    emit_event(project_id, "project", "update", f"Project metadata updated", {"type": "project", "id": project_id})
    return _build_summary(found)


# ── Overview ─────────────────────────────────────────────
@router.get("/{project_id}/content/overview", response_model=dict)
async def get_overview(project_id: str):
    pdir = _project_dir(project_id)
    content = read_markdown(pdir / "content" / "overview.md")
    return {"content": content}


@router.put("/{project_id}/content/overview")
async def put_overview(project_id: str, body: dict):
    pdir = _project_dir(project_id)
    write_markdown(pdir / "content" / "overview.md", body.get("content", ""))
    return {"status": "ok"}


# ── Structured Overview ──────────────────────────────────
@router.get("/{project_id}/content/overview_structured")
async def get_overview_structured(project_id: str):
    pdir = settings.projects_dir / project_id
    if not pdir.exists():
        _ensure_project_scaffold(project_id)
    json_path = pdir / "content" / "overview.json"
    if json_path.exists():
        return read_json(json_path)
    # Fallback: parse from markdown on-the-fly
    md = read_markdown(pdir / "content" / "overview.md")
    if md:
        data = parse_overview_md(md)
        write_json(json_path, data)
        return data
    return {"title": "", "sections": []}


@router.put("/{project_id}/content/overview_structured")
async def put_overview_structured(project_id: str, body: dict):
    pdir = _project_dir(project_id)
    write_json(pdir / "content" / "overview.json", body)
    return {"status": "ok"}


# ── Core Description ─────────────────────────────────────
@router.get("/{project_id}/core_description")
async def get_core_description(project_id: str):
    pdir = _project_dir(project_id)
    path = pdir / "content" / "core_description.json"
    if path.exists():
        return read_json(path)
    return {"text": "", "updated_at": None}


@router.put("/{project_id}/core_description")
async def put_core_description(project_id: str, body: dict):
    pdir = _project_dir(project_id)
    text = body.get("text", "")
    if len(text) > 4000:
        raise HTTPException(400, "Core description must be 4000 characters or fewer")
    (pdir / "content").mkdir(parents=True, exist_ok=True)
    payload = {"text": text, "updated_at": datetime.utcnow().isoformat()}
    write_json(pdir / "content" / "core_description.json", payload)
    return payload


# ── Execution Steps ──────────────────────────────────────
@router.get("/{project_id}/execution/{step_type}")
async def get_execution_steps(project_id: str, step_type: str):
    pdir = _project_dir(project_id)
    fname = f"{step_type}_steps.yaml"
    data = read_yaml(pdir / "execution" / fname)
    return {"steps": data.get("steps", [])}


@router.put("/{project_id}/execution/{step_type}")
async def put_execution_steps(project_id: str, step_type: str, body: dict):
    pdir = _project_dir(project_id)
    (pdir / "execution").mkdir(parents=True, exist_ok=True)
    fname = f"{step_type}_steps.yaml"
    write_yaml(pdir / "execution" / fname, {"steps": body.get("steps", [])})
    return {"status": "ok"}


@router.patch("/{project_id}/execution/{step_type}/steps/{step_id}")
async def update_execution_step(project_id: str, step_type: str, step_id: str, body: dict):
    pdir = _project_dir(project_id)
    fname = f"{step_type}_steps.yaml"
    path = pdir / "execution" / fname
    data = read_yaml(path)
    steps = data.get("steps", [])
    for s in steps:
        if s["id"] == step_id:
            for k, v in body.items():
                if k in ("status", "title", "description", "acceptance"):
                    s[k] = v
            write_yaml(path, {"steps": steps})

            # Also sync to checklists for metric consistency
            cl_type = "vibe_coding" if step_type == "vc" else "vibe_research"
            _sync_steps_to_checklist(pdir, cl_type, steps)

            action = "status_change" if "status" in body else "update"
            emit_event(project_id, "step", action, f"Step {step_id} ({step_type}): {s.get('title','')} → {body.get('status', s.get('status',''))}", {"type": "step", "id": step_id, "extra": {"step_type": step_type}})

            return s
    raise HTTPException(404, f"Step {step_id} not found")


@router.post("/{project_id}/execution/{step_type}/reorder")
async def reorder_execution_steps(project_id: str, step_type: str, body: dict):
    """Reorder steps. Supports two modes:
    - ordered_ids: ["VC-01", "VC-03", ...] — full reorder (preferred for drag-and-drop)
    - from_index / to_index: move single step (legacy)
    """
    pdir = _project_dir(project_id)
    fname = f"{step_type}_steps.yaml"
    path = pdir / "execution" / fname
    data = read_yaml(path)
    steps = data.get("steps", [])

    ordered_ids = body.get("ordered_ids")
    if ordered_ids:
        id_set = {s["id"] for s in steps}
        if set(ordered_ids) != id_set:
            raise HTTPException(400, f"ordered_ids must contain exactly the existing step IDs (expected {sorted(id_set)}, got {sorted(ordered_ids)})")
        if len(ordered_ids) != len(set(ordered_ids)):
            raise HTTPException(400, "Duplicate IDs in ordered_ids")
        step_map = {s["id"]: s for s in steps}
        steps = [step_map[sid] for sid in ordered_ids]
    else:
        fi, ti = body.get("from_index"), body.get("to_index")
        if fi is None or ti is None or not (0 <= fi < len(steps)) or not (0 <= ti < len(steps)):
            raise HTTPException(400, "Invalid indices")
        steps.insert(ti, steps.pop(fi))

    write_yaml(path, {"steps": steps})
    cl_type = "vibe_coding" if step_type == "vc" else "vibe_research"
    _sync_steps_to_checklist(pdir, cl_type, steps)
    return {"status": "ok", "order": [s["id"] for s in steps]}


@router.post("/{project_id}/execution/{step_type}/step/add")
async def add_execution_step(project_id: str, step_type: str, body: dict):
    """Insert a new step below the given after_id (or append if not provided)."""
    pdir = _project_dir(project_id)
    fname = f"{step_type}_steps.yaml"
    path = pdir / "execution" / fname
    (pdir / "execution").mkdir(parents=True, exist_ok=True)
    data = read_yaml(path) if path.exists() else {}
    steps = data.get("steps", [])

    # Generate unique ID
    prefix = step_type.upper() + "-"
    existing_ids = {s["id"] for s in steps}
    num = len(steps) + 1
    new_id = body.get("id", "")
    if not new_id or new_id in existing_ids:
        while f"{prefix}{num:02d}" in existing_ids:
            num += 1
        new_id = f"{prefix}{num:02d}"

    new_step = {
        "id": new_id,
        "title": body.get("title", "New Step"),
        "description": body.get("description", ""),
        "acceptance": body.get("acceptance", ""),
        "section": body.get("section", "default"),
        "status": body.get("status", "todo"),
        "prompt_hint": body.get("prompt_hint", ""),
        "linked_milestone": body.get("linked_milestone", ""),
    }

    after_id = body.get("after_id")
    inserted = False
    if after_id:
        for i, s in enumerate(steps):
            if s["id"] == after_id:
                steps.insert(i + 1, new_step)
                inserted = True
                break
    if not inserted:
        steps.append(new_step)

    write_yaml(path, {"steps": steps})
    cl_type = "vibe_coding" if step_type == "vc" else "vibe_research"
    _sync_steps_to_checklist(pdir, cl_type, steps)
    emit_event(project_id, "step", "add", f"Added step {new_id} ({step_type}): {new_step['title']}", {"type": "step", "id": new_id, "extra": {"step_type": step_type}})
    return new_step


@router.post("/{project_id}/execution/{step_type}/step/delete")
async def delete_execution_step(project_id: str, step_type: str, body: dict):
    """Delete a step by ID."""
    step_id = body.get("step_id")
    if not step_id:
        raise HTTPException(400, "step_id is required")
    pdir = _project_dir(project_id)
    fname = f"{step_type}_steps.yaml"
    path = pdir / "execution" / fname
    data = read_yaml(path)
    steps = data.get("steps", [])

    original_len = len(steps)
    steps = [s for s in steps if s["id"] != step_id]
    if len(steps) == original_len:
        raise HTTPException(404, f"Step {step_id} not found")

    write_yaml(path, {"steps": steps})
    cl_type = "vibe_coding" if step_type == "vc" else "vibe_research"
    _sync_steps_to_checklist(pdir, cl_type, steps)
    emit_event(project_id, "step", "delete", f"Deleted step {step_id} ({step_type})", {"type": "step", "id": step_id, "extra": {"step_type": step_type}})
    return {"status": "ok", "deleted": step_id, "remaining": len(steps)}


@router.post("/{project_id}/execution/generate")
async def generate_execution(project_id: str):
    pdir = _project_dir(project_id)
    json_path = pdir / "content" / "overview.json"

    if json_path.exists():
        overview = read_json(json_path)
    else:
        md = read_markdown(pdir / "content" / "overview.md")
        if not md:
            raise HTTPException(400, "No overview data to generate steps from")
        overview = parse_overview_md(md)
        write_json(json_path, overview)

    result = generate_execution_steps(overview)

    (pdir / "execution").mkdir(parents=True, exist_ok=True)
    write_yaml(pdir / "execution" / "vc_steps.yaml", {"steps": result["vc_steps"]})
    write_yaml(pdir / "execution" / "vr_steps.yaml", {"steps": result["vr_steps"]})

    # Sync to checklists for progress tracking
    _sync_steps_to_checklist(pdir, "vibe_coding", result["vc_steps"])
    _sync_steps_to_checklist(pdir, "vibe_research", result["vr_steps"])

    return {
        "status": "ok",
        "vc_steps_count": len(result["vc_steps"]),
        "vr_steps_count": len(result["vr_steps"]),
    }


def _sync_steps_to_checklist(pdir, cl_name: str, steps: list[dict]) -> None:
    """Keep checklist in sync with execution steps for progress metrics."""
    cl_path = pdir / "checklists" / f"{cl_name}.yaml"
    items = []
    for s in steps:
        items.append({
            "id": s["id"],
            "section": s.get("section", "default"),
            "text": s["title"],
            "status": s.get("status", "todo"),
            "notes": s.get("description", ""),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": None,
        })
    write_yaml(cl_path, {"items": items})


# ── Checklists ───────────────────────────────────────────
@router.get("/{project_id}/checklists/{cl_type}", response_model=Checklist)
async def get_checklist(project_id: str, cl_type: str):
    pdir = _project_dir(project_id)
    fname = f"vibe_{cl_type}.yaml" if cl_type in ("coding", "research") else f"{cl_type}.yaml"
    data = read_yaml(pdir / "checklists" / fname)
    return Checklist(items=[ChecklistItem(**i) for i in data.get("items", [])])


@router.put("/{project_id}/checklists/{cl_type}", response_model=Checklist)
async def put_checklist(project_id: str, cl_type: str, checklist: Checklist):
    pdir = _project_dir(project_id)
    fname = f"vibe_{cl_type}.yaml" if cl_type in ("coding", "research") else f"{cl_type}.yaml"
    write_yaml(pdir / "checklists" / fname, {"items": [i.model_dump() for i in checklist.items]})
    return checklist


@router.post("/{project_id}/checklists/{cl_type}/items", response_model=ChecklistItem)
async def add_checklist_item(project_id: str, cl_type: str, item: ChecklistItemCreate):
    pdir = _project_dir(project_id)
    fname = f"vibe_{cl_type}.yaml" if cl_type in ("coding", "research") else f"{cl_type}.yaml"
    path = pdir / "checklists" / fname
    data = read_yaml(path)
    items = data.get("items", [])
    new_item = ChecklistItem(
        id=str(uuid.uuid4())[:8],
        section=item.section,
        text=item.text,
        status=item.status,
        notes=item.notes,
    )
    items.append(new_item.model_dump())
    write_yaml(path, {"items": items})
    return new_item


@router.patch("/{project_id}/checklists/{cl_type}/items/{item_id}", response_model=ChecklistItem)
async def update_checklist_item(project_id: str, cl_type: str, item_id: str, update: ChecklistItemUpdate):
    pdir = _project_dir(project_id)
    fname = f"vibe_{cl_type}.yaml" if cl_type in ("coding", "research") else f"{cl_type}.yaml"
    path = pdir / "checklists" / fname
    data = read_yaml(path)
    items = data.get("items", [])
    for i in items:
        if i["id"] == item_id:
            if update.text is not None:
                i["text"] = update.text
            if update.status is not None:
                i["status"] = update.status
            if update.notes is not None:
                i["notes"] = update.notes
            if update.section is not None:
                i["section"] = update.section
            i["updated_at"] = datetime.utcnow().isoformat()
            write_yaml(path, {"items": items})
            return ChecklistItem(**i)
    raise HTTPException(404, f"Checklist item {item_id} not found")


# ── Logs ─────────────────────────────────────────────────
@router.get("/{project_id}/logs/{log_type}", response_model=list[LogEntry])
async def get_logs(project_id: str, log_type: str, limit: int = 50):
    pdir = _project_dir(project_id)
    fname = f"vibe_{log_type}.jsonl" if log_type in ("coding", "research") else f"{log_type}.jsonl"
    entries = read_jsonl(pdir / "logs" / fname, limit=limit)
    return [LogEntry(**e) for e in entries]


@router.post("/{project_id}/logs/{log_type}", response_model=LogEntry)
async def add_log(project_id: str, log_type: str, entry: LogEntryCreate):
    pdir = _project_dir(project_id)
    fname = f"vibe_{log_type}.jsonl" if log_type in ("coding", "research") else f"{log_type}.jsonl"
    log_entry = LogEntry(
        type=entry.type,
        summary=entry.summary,
        details=entry.details,
        duration_min=entry.duration_min,
        checklist_item_id=entry.checklist_item_id,
    )
    append_jsonl(pdir / "logs" / fname, log_entry.model_dump())

    emit_event(project_id, "log", "create", f"Log added ({log_type}): {entry.summary[:80]}", {"type": "log", "id": log_type})

    # Update last_activity
    proj_yaml_path = pdir / "project.yaml"
    proj_data = read_yaml(proj_yaml_path)
    proj_data["last_activity"] = datetime.utcnow().isoformat()
    write_yaml(proj_yaml_path, proj_data)

    return log_entry


# ── Artifacts ────────────────────────────────────────────
def _repair_artifact(raw: dict) -> dict:
    """Ensure an artifact dict has all required fields, filling defaults."""
    return {
        "id": raw.get("id") or str(uuid.uuid4())[:8],
        "type": raw.get("type") or "other",
        "name": raw.get("name") or "Untitled",
        "path": raw.get("path") or "",
        "description": raw.get("description") or "",
        "linked_milestone": raw.get("linked_milestone") or "",
    }


def _load_artifacts(pdir) -> list[dict]:
    """Tolerantly load artifacts with auto-repair for missing fields."""
    path = pdir / "artifacts" / "index.yaml"
    data = read_yaml(path)
    raw_list = data.get("artifacts", [])
    if not isinstance(raw_list, list):
        raw_list = []
    repaired = [_repair_artifact(a) for a in raw_list if isinstance(a, dict)]
    # If repair changed anything, write back
    if repaired != raw_list:
        (pdir / "artifacts").mkdir(parents=True, exist_ok=True)
        write_yaml(path, {"artifacts": repaired})
    return repaired


@router.get("/{project_id}/artifacts", response_model=list[Artifact])
async def get_artifacts(project_id: str):
    pdir = _project_dir(project_id)
    artifacts = _load_artifacts(pdir)
    return [Artifact(**a) for a in artifacts]


@router.post("/{project_id}/artifacts", response_model=Artifact)
async def add_artifact(project_id: str, item: ArtifactCreate):
    pdir = _project_dir(project_id)
    path = pdir / "artifacts" / "index.yaml"
    artifacts = _load_artifacts(pdir)
    new = Artifact(
        id=str(uuid.uuid4())[:8],
        type=item.type,
        name=item.name,
        path=item.path,
        description=item.description,
        linked_milestone=item.linked_milestone,
    )
    artifacts.append(new.model_dump())
    write_yaml(path, {"artifacts": artifacts})

    emit_event(project_id, "artifact", "create", f"Artifact added: {item.name}", {"type": "artifact", "id": new.id})

    return new


# ── Milestones ───────────────────────────────────────────
@router.get("/{project_id}/milestones", response_model=list[Milestone])
async def get_milestones(project_id: str):
    pdir = _project_dir(project_id)
    data = read_yaml(pdir / "timeline" / "milestones.yaml")
    return [Milestone(**m) for m in data.get("milestones", [])]


@router.post("/{project_id}/milestones", response_model=Milestone)
async def add_milestone(project_id: str, body: dict):
    pdir = _project_dir(project_id)
    path = pdir / "timeline" / "milestones.yaml"
    (pdir / "timeline").mkdir(parents=True, exist_ok=True)
    data = read_yaml(path)
    milestones = data.get("milestones", [])
    new_id = body.get("id", f"M{len(milestones)+1}")
    new = Milestone(
        id=new_id,
        title=body.get("title", "New Milestone"),
        deadline=body.get("deadline", ""),
        status=body.get("status", "pending"),
        acceptance=body.get("acceptance", ""),
        owner=body.get("owner", ""),
    )
    milestones.append(new.model_dump())
    write_yaml(path, {"milestones": milestones})
    emit_event(project_id, "timeline", "create", f"Milestone {new_id}: {new.title}", {"type": "milestone", "id": new_id})
    return new


@router.patch("/{project_id}/milestones/{milestone_id}")
async def update_milestone(project_id: str, milestone_id: str, body: dict):
    pdir = _project_dir(project_id)
    path = pdir / "timeline" / "milestones.yaml"
    data = read_yaml(path)
    milestones = data.get("milestones", [])
    for m in milestones:
        if m["id"] == milestone_id:
            for k, v in body.items():
                if k in ("status", "title", "deadline", "acceptance", "owner"):
                    m[k] = v
            write_yaml(path, {"milestones": milestones})
            emit_event(project_id, "timeline", "status_change" if "status" in body else "update", f"Milestone {milestone_id}: {m.get('title','')} → {body.get('status', m.get('status',''))}", {"type": "milestone", "id": milestone_id})
            return m
    raise HTTPException(404, f"Milestone {milestone_id} not found")


@router.post("/{project_id}/milestones/reorder")
async def reorder_milestones(project_id: str, body: dict):
    """Reorder milestones. Supports two modes:
    - ordered_ids: ["T1", "T3", ...] — full reorder (preferred for drag-and-drop)
    - from_index / to_index: move single milestone (legacy)
    """
    pdir = _project_dir(project_id)
    path = pdir / "timeline" / "milestones.yaml"
    data = read_yaml(path)
    milestones = data.get("milestones", [])

    ordered_ids = body.get("ordered_ids")
    if ordered_ids:
        id_set = {m["id"] for m in milestones}
        if set(ordered_ids) != id_set:
            raise HTTPException(400, f"ordered_ids must contain exactly the existing milestone IDs (expected {sorted(id_set)}, got {sorted(ordered_ids)})")
        if len(ordered_ids) != len(set(ordered_ids)):
            raise HTTPException(400, "Duplicate IDs in ordered_ids")
        ms_map = {m["id"]: m for m in milestones}
        milestones = [ms_map[mid] for mid in ordered_ids]
    else:
        fi, ti = body.get("from_index"), body.get("to_index")
        if fi is None or ti is None or not (0 <= fi < len(milestones)) or not (0 <= ti < len(milestones)):
            raise HTTPException(400, "Invalid indices")
        milestones.insert(ti, milestones.pop(fi))

    write_yaml(path, {"milestones": milestones})
    return {"status": "ok", "order": [m["id"] for m in milestones]}


# ── Kanban (projection of milestones — canonical source is milestones.yaml) ──

_STATUS_TO_COL = {"pending": "backlog", "in_progress": "doing", "done": "done", "overdue": "backlog"}
_COL_TO_STATUS = {"backlog": "pending", "doing": "in_progress", "done": "done"}

def _milestone_to_kanban(m: dict) -> dict:
    return {
        "id": m["id"],
        "title": m.get("title", ""),
        "column": _STATUS_TO_COL.get(m.get("status", "pending"), "backlog"),
        "description": m.get("acceptance", ""),
        "linked_milestone": m["id"],
    }

@router.get("/{project_id}/kanban", response_model=list[KanbanItem])
async def get_kanban(project_id: str):
    """Kanban is a projection of milestones. Column derived from status."""
    pdir = _project_dir(project_id)
    data = read_yaml(pdir / "timeline" / "milestones.yaml")
    return [KanbanItem(**_milestone_to_kanban(m)) for m in data.get("milestones", [])]


@router.patch("/{project_id}/kanban/{item_id}")
async def update_kanban_item(project_id: str, item_id: str, body: dict):
    """Update a kanban card. Column changes map to milestone status changes."""
    pdir = _project_dir(project_id)
    path = pdir / "timeline" / "milestones.yaml"
    data = read_yaml(path)
    milestones = data.get("milestones", [])
    for m in milestones:
        if m["id"] == item_id:
            if "column" in body:
                m["status"] = _COL_TO_STATUS.get(body["column"], m.get("status", "pending"))
            if "title" in body:
                m["title"] = body["title"]
            if "description" in body:
                m["acceptance"] = body["description"]
            write_yaml(path, {"milestones": milestones})
            emit_event(project_id, "timeline", "status_change", f"Milestone {item_id}: → {m.get('status','')}", {"type": "milestone", "id": item_id})
            return _milestone_to_kanban(m)
    raise HTTPException(404, f"Kanban item {item_id} not found")


# ── Generate Timeline ────────────────────────────────────
@router.post("/{project_id}/timeline/generate")
async def generate_timeline(project_id: str):
    pdir = _project_dir(project_id)
    json_path = pdir / "content" / "overview.json"

    if json_path.exists():
        overview = read_json(json_path)
    else:
        md = read_markdown(pdir / "content" / "overview.md")
        if not md:
            raise HTTPException(400, "No overview data")
        overview = parse_overview_md(md)
        write_json(json_path, overview)

    sections = {s["type"]: s for s in overview.get("sections", [])}
    milestone_items = sections.get("milestones", {}).get("items", [])
    deliverables = sections.get("deliverables", {}).get("items", [])

    # Generate milestones.yaml
    milestones = []
    for m in milestone_items:
        milestones.append({
            "id": m.get("id", ""),
            "title": m.get("title", ""),
            "deadline": m.get("week", ""),
            "status": m.get("status", "pending"),
            "acceptance": m.get("acceptance", ""),
            "owner": "",
        })

    (pdir / "timeline").mkdir(parents=True, exist_ok=True)
    write_yaml(pdir / "timeline" / "milestones.yaml", {"milestones": milestones})

    # Kanban is now a projection of milestones — no separate file needed

    return {
        "status": "ok",
        "milestones_count": len(milestones),
        "kanban_count": len(milestones),
    }


# ── Quick Add Project Import ─────────────────────────────
@router.post("/import")
async def import_project(body: dict):
    """Create a new project from a YAML-like dict template and auto-generate all data."""
    import re as _re

    pid = body.get("id", "")
    name = body.get("name", "")
    if not pid or not name:
        raise HTTPException(400, "id and name are required")

    # Validate id format
    if not _re.match(r"^[a-z0-9][a-z0-9-]*$", pid):
        raise HTTPException(400, "id must be lowercase alphanumeric with hyphens")

    # Check for duplicate
    cfg = _load_projects_config()
    if any(p["id"] == pid for p in cfg):
        raise HTTPException(409, f"Project {pid} already exists")

    # Register in projects.yaml
    new_entry = {
        "id": pid,
        "name": name,
        "name_en": body.get("name_en", ""),
        "definition": body.get("definition", ""),
        "pillar": body.get("pillar", ""),
        "tags": body.get("tags", []),
        "priority": body.get("priority", "P2"),
    }
    cfg.append(new_entry)
    write_yaml(settings.config_dir / "projects.yaml", {"projects": cfg})

    # Create project directory structure
    pdir = settings.projects_dir / pid
    for sub in ["content", "checklists", "logs", "execution", "artifacts", "timeline", "literature/normalized", "literature/sources"]:
        (pdir / sub).mkdir(parents=True, exist_ok=True)

    # Write project.yaml
    write_yaml(pdir / "project.yaml", {
        "rag": body.get("rag", "green"),
        "priority": body.get("priority", "P2"),
        "tags": body.get("tags", []),
    })

    # Write overview.md from template sections
    overview_sections = body.get("overview", {})
    md_lines = [f"# {name}\n"]
    section_order = ["definition", "motivation", "scope", "questions", "concepts", "pipeline", "evaluation", "deliverables", "milestones", "risks", "literature", "actions"]
    for sec in section_order:
        content = overview_sections.get(sec, body.get(sec, ""))
        if content:
            title = sec.replace("_", " ").title()
            md_lines.append(f"\n## {title}\n")
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict):
                        md_lines.append(f"- **{item.get('id', item.get('title', ''))}**: {item.get('title', item.get('text', ''))}")
                        if item.get("acceptance"):
                            md_lines.append(f"  - Acceptance: {item['acceptance']}")
                        if item.get("week"):
                            md_lines.append(f"  - Week: {item['week']}")
                    else:
                        md_lines.append(f"- {item}")
            else:
                md_lines.append(str(content))
    md_lines.append("")
    overview_md = "\n".join(md_lines)
    write_markdown(pdir / "content" / "overview.md", overview_md)

    # Parse to structured JSON
    overview = parse_overview_md(overview_md)

    # Enrich with raw template data if parser missed structured items
    raw_milestones = overview_sections.get("milestones", [])
    raw_deliverables = overview_sections.get("deliverables", [])
    raw_concepts = overview_sections.get("concepts", [])
    raw_pipeline = overview_sections.get("pipeline", [])

    sections_by_type = {s["type"]: s for s in overview.get("sections", [])}

    if raw_milestones and not sections_by_type.get("milestones", {}).get("items"):
        ms_section = sections_by_type.get("milestones", {"type": "milestones", "title": "Milestones", "items": []})
        ms_section["items"] = [
            m if isinstance(m, dict) else {"title": str(m)}
            for m in raw_milestones
        ]
        if "milestones" not in sections_by_type:
            overview.setdefault("sections", []).append(ms_section)

    if raw_deliverables and not sections_by_type.get("deliverables", {}).get("items"):
        dl_section = sections_by_type.get("deliverables", {"type": "deliverables", "title": "Deliverables", "items": []})
        dl_section["items"] = raw_deliverables
        if "deliverables" not in sections_by_type:
            overview.setdefault("sections", []).append(dl_section)

    if raw_concepts and not sections_by_type.get("concepts", {}).get("items"):
        cn_section = sections_by_type.get("concepts", {"type": "concepts", "title": "Concepts", "items": []})
        cn_section["items"] = raw_concepts
        if "concepts" not in sections_by_type:
            overview.setdefault("sections", []).append(cn_section)

    if raw_pipeline and not sections_by_type.get("pipeline", {}).get("items"):
        pl_section = sections_by_type.get("pipeline", {"type": "pipeline", "title": "Pipeline", "items": []})
        pl_section["items"] = raw_pipeline
        if "pipeline" not in sections_by_type:
            overview.setdefault("sections", []).append(pl_section)

    write_json(pdir / "content" / "overview.json", overview)

    # Generate execution steps
    step_result = generate_execution_steps(overview)
    write_yaml(pdir / "execution" / "vc_steps.yaml", {"steps": step_result["vc_steps"]})
    write_yaml(pdir / "execution" / "vr_steps.yaml", {"steps": step_result["vr_steps"]})

    # Sync to checklists
    _sync_steps_to_checklist(pdir, "coding", step_result["vc_steps"])
    _sync_steps_to_checklist(pdir, "research", step_result["vr_steps"])

    # Generate timeline
    sections = {s["type"]: s for s in overview.get("sections", [])}
    milestone_items = sections.get("milestones", {}).get("items", [])
    deliverables = sections.get("deliverables", {}).get("items", [])

    milestones = []
    for m in milestone_items:
        milestones.append({
            "id": m.get("id", ""),
            "title": m.get("title", ""),
            "deadline": m.get("week", ""),
            "status": m.get("status", "pending"),
            "acceptance": m.get("acceptance", ""),
            "owner": "",
        })
    write_yaml(pdir / "timeline" / "milestones.yaml", {"milestones": milestones})
    # Kanban is a projection of milestones — no separate file needed

    # Init empty artifacts
    write_yaml(pdir / "artifacts" / "index.yaml", {"artifacts": []})

    return {
        "status": "ok",
        "project_id": pid,
        "generated": {
            "overview": True,
            "vc_steps": len(step_result["vc_steps"]),
            "vr_steps": len(step_result["vr_steps"]),
            "milestones": len(milestones),
        },
    }
