"""DesignSpec import, literature export, and prompt template endpoints."""

import csv
import io
import shutil
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

import orjson

from ..config import settings
from ..utils import read_yaml, write_yaml, read_json, write_json, atomic_write
from ..events import emit_event

router = APIRouter(prefix="/projects", tags=["designspec"])


# ── Helpers ──────────────────────────────────────────────

def _project_dir(project_id: str) -> Path:
    pdir = settings.projects_dir / project_id
    if not pdir.exists():
        raise HTTPException(404, f"Project {project_id} not found")
    return pdir


def _load_project_papers(project_id: str) -> list[dict]:
    path = settings.projects_dir / project_id / "literature" / "normalized" / "papers.jsonl"
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").strip().split("\n")
    return [orjson.loads(l) for l in lines if l.strip()]


def _load_overview(pdir: Path) -> dict:
    return read_json(pdir / "content" / "overview.json")


def _load_designspec(pdir: Path) -> dict | None:
    """Load the most recent designspec if one exists."""
    imports_dir = pdir / "imports"
    if not imports_dir.exists():
        return None
    specs = sorted(imports_dir.glob("designspec_*.json"), reverse=True)
    if not specs:
        return None
    return orjson.loads(specs[0].read_bytes())


# ══════════════════════════════════════════════════════════
# C1) Literature Full CSV Export
# ══════════════════════════════════════════════════════════

CSV_FIELDS = [
    "paper_id", "title", "year", "date", "authors", "journal",
    "citation_count", "doi", "link", "abstract", "tags",
    "relevance_summary", "topic_match_score",
    "is_open_access", "open_access_link", "semantic_scholar_id",
]


@router.get("/{project_id}/literature/export_full_csv")
async def export_full_csv(project_id: str):
    """Export all normalized literature for this project as CSV."""
    pdir = _project_dir(project_id)
    papers = _load_project_papers(project_id)

    # Also check global papers dir for enriched tag data
    papers_dir = settings.literature_dir / "papers"
    for p in papers:
        ppdir = papers_dir / p.get("paper_id", "")
        if ppdir.exists():
            tag_data = read_yaml(ppdir / "tags.yaml")
            if tag_data.get("tags"):
                p["tags"] = tag_data["tags"]

    # Also gather from source CSV files to capture any fields not in jsonl
    # (the jsonl is the canonical normalized store)

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_FIELDS, extrasaction="ignore")
    writer.writeheader()
    for p in papers:
        row = dict(p)
        # Flatten tags list to comma-separated
        if isinstance(row.get("tags"), list):
            row["tags"] = ", ".join(row["tags"])
        writer.writerow(row)

    content = buf.getvalue()
    filename = f"{project_id}_literature_full.csv"

    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ══════════════════════════════════════════════════════════
# C2) Prompt Template Downloads
# ══════════════════════════════════════════════════════════

def _repo_root() -> Path:
    """Locate the repo root (parent of backend/)."""
    return Path(__file__).resolve().parent.parent.parent.parent


def _read_template_file(name: str) -> str:
    """Read a prompt template from templates/prompt/<name>. Raises 500 if missing."""
    path = _repo_root() / "templates" / "prompt" / name
    if not path.exists():
        raise HTTPException(500, f"Template file missing: {path}")
    return path.read_text(encoding="utf-8")


def _build_prompt_header(project_id: str, overview: dict) -> str:
    """Build a small header block with project context (prepended to the file body)."""
    title = overview.get("title", project_id)
    definition = ""
    for sec in overview.get("sections", []):
        if sec.get("type") == "definition":
            definition = sec.get("content", sec.get("raw", ""))
            break
    lines = [
        f"<!-- project_id: {project_id} -->",
        f"<!-- project_title: {title} -->",
    ]
    if definition:
        lines.append(f"<!-- project_definition: {definition[:300]} -->")
    lines.append("")
    return "\n".join(lines)


@router.get("/{project_id}/literature/prompts/review_prompt")
async def download_review_prompt(project_id: str):
    """Download the Literature Review / Survey Synthesis prompt template (from disk file)."""
    pdir = _project_dir(project_id)
    overview = _load_overview(pdir)
    header = _build_prompt_header(project_id, overview)
    body = _read_template_file("review_prompt.md")
    content = header + body
    filename = f"{project_id}_prompt_lit_review.md"

    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{project_id}/literature/prompts/designspec_prompt")
async def download_designspec_prompt(project_id: str):
    """Download the Innovation & Method Design prompt template (from disk file)."""
    pdir = _project_dir(project_id)
    overview = _load_overview(pdir)
    header = _build_prompt_header(project_id, overview)
    body = _read_template_file("designspec_prompt.md")
    content = header + body
    filename = f"{project_id}_prompt_designspec.md"

    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ══════════════════════════════════════════════════════════
# C3) Upload & Apply DesignSpec
# ══════════════════════════════════════════════════════════

REQUIRED_TOP_KEYS = {"schema_version", "project_id", "topic", "method", "evaluation", "execution_plan", "timeline"}


def _validate_designspec(data: dict, project_id: str) -> list[str]:
    """Validate DesignSpec JSON. Returns list of errors (empty = valid)."""
    errors = []

    # Top-level keys
    missing = REQUIRED_TOP_KEYS - set(data.keys())
    if missing:
        errors.append(f"Missing top-level keys: {', '.join(sorted(missing))}")

    if data.get("schema_version") != 1:
        errors.append(f"schema_version must be 1, got {data.get('schema_version')}")

    # Minimum counts
    themes = data.get("related_work_summary", {}).get("themes", [])
    if len(themes) < 4:
        errors.append(f"themes: need >= 4, got {len(themes)}")

    claims = data.get("innovation", {}).get("core_claims", [])
    if len(claims) < 3:
        errors.append(f"core_claims: need >= 3, got {len(claims)}")

    modules = data.get("method", {}).get("architecture", {}).get("modules", [])
    if len(modules) < 4:
        errors.append(f"modules: need >= 4, got {len(modules)}")

    datasets = data.get("evaluation", {}).get("datasets", [])
    if len(datasets) < 2:
        errors.append(f"datasets: need >= 2, got {len(datasets)}")

    baselines = data.get("evaluation", {}).get("baselines", [])
    if len(baselines) < 5:
        errors.append(f"baselines: need >= 5, got {len(baselines)}")

    vc_steps = data.get("execution_plan", {}).get("vibe_coding_steps", [])
    if not (10 <= len(vc_steps) <= 18):
        errors.append(f"vibe_coding_steps: need 10–18, got {len(vc_steps)}")

    vr_steps = data.get("execution_plan", {}).get("vibe_research_steps", [])
    if not (10 <= len(vr_steps) <= 18):
        errors.append(f"vibe_research_steps: need 10–18, got {len(vr_steps)}")

    milestones = data.get("timeline", {}).get("milestones", [])
    if len(milestones) < 6:
        errors.append(f"milestones: need >= 6, got {len(milestones)}")

    artifacts = data.get("artifact_plan", [])
    if len(artifacts) < 12:
        errors.append(f"artifact_plan: need >= 12, got {len(artifacts)}")

    return errors


def _backup_project_files(pdir: Path, ts: str) -> Path:
    """Create timestamped backup of key project files before applying DesignSpec."""
    backup_dir = pdir / "imports" / f"backup_before_designspec_{ts}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    files_to_backup = [
        pdir / "content" / "overview.json",
        pdir / "execution" / "vc_steps.yaml",
        pdir / "execution" / "vr_steps.yaml",
        pdir / "timeline" / "milestones.yaml",
        pdir / "artifacts" / "index.yaml",
    ]

    for f in files_to_backup:
        if f.exists():
            shutil.copy2(f, backup_dir / f.name)

    return backup_dir


def _apply_overview_updates(pdir: Path, spec: dict) -> int:
    """Update overview.json with structured DesignSpec sections (Core Innovation, Method Overview, Evaluation Plan).
    Returns count of sections updated. Preserves user sections that are unrelated."""
    overview = read_json(pdir / "content" / "overview.json")
    if not overview:
        overview = {"title": spec.get("topic", {}).get("title", ""), "sections": []}

    sections = overview.get("sections", [])
    updated = 0

    method = spec.get("method", {})
    evaluation = spec.get("evaluation", {})
    innovation = spec.get("innovation", {})

    new_sections = []
    ts_now = datetime.utcnow().isoformat() + "Z"

    # 1) Core Innovation section
    if innovation:
        claims = innovation.get("core_claims", [])
        why_now = innovation.get("why_now", [])
        diffs = innovation.get("differentiators", [])
        items = []
        for c in claims:
            items.append({"label": c, "done": False})
        new_sections.append({
            "title": "Core Innovation",
            "heading": "Core Innovation",
            "type": "checklist",
            "designspec_source": True,
            "updated_at": ts_now,
            "callout": f"{len(claims)} core claims · {len(diffs)} differentiators",
            "content": "\n".join(f"- {c}" for c in claims),
            "items": items,
            "subsections": [
                {"heading": "Why Now", "items": [{"label": w, "done": False} for w in why_now]},
                {"heading": "Differentiators", "items": [{"label": d, "done": False} for d in diffs]},
            ],
        })

    # 2) Method Overview section
    if method:
        modules = method.get("architecture", {}).get("modules", [])
        dataflow = method.get("architecture", {}).get("dataflow", [])
        algorithms = method.get("architecture", {}).get("algorithms", [])
        modules_table = []
        for m in modules:
            modules_table.append({
                "id": m.get("id", ""),
                "name": m.get("name", ""),
                "inputs": ", ".join(m.get("inputs", [])),
                "outputs": ", ".join(m.get("outputs", [])),
            })
        algo_blocks = []
        for a in algorithms:
            algo_blocks.append({"name": a.get("name", ""), "pseudo": a.get("pseudo", "")})
        new_sections.append({
            "title": "Method Overview",
            "heading": "Method Overview",
            "type": "pipeline",
            "designspec_source": True,
            "updated_at": ts_now,
            "callout": f"{method.get('name', 'Unnamed Method')} — {len(modules)} modules",
            "content": method.get("problem_definition", ""),
            "table": {"columns": ["ID", "Module", "Inputs", "Outputs"], "rows": modules_table},
            "dataflow": dataflow,
            "algorithms": algo_blocks,
        })

    # 3) Evaluation Plan section
    if evaluation:
        datasets = evaluation.get("datasets", [])
        baselines = evaluation.get("baselines", [])
        metrics = evaluation.get("metrics", [])
        protocols = evaluation.get("protocols", [])
        stress_tests = evaluation.get("stress_tests", [])
        repro = evaluation.get("reproducibility", [])
        ds_table = []
        for d in datasets:
            ds_table.append({"name": d.get("name", ""), "source": d.get("source", ""), "split": d.get("split", ""), "notes": d.get("notes", "")})
        new_sections.append({
            "title": "Evaluation Plan",
            "heading": "Evaluation Plan",
            "type": "evaluation",
            "designspec_source": True,
            "updated_at": ts_now,
            "callout": f"{len(datasets)} datasets · {len(baselines)} baselines · {len(metrics)} metrics",
            "datasets_table": {"columns": ["Dataset", "Source", "Split", "Notes"], "rows": ds_table},
            "baselines": [{"name": b.get("name", ""), "type": b.get("type", ""), "why": b.get("why", "")} for b in baselines],
            "metrics": metrics,
            "checklist": [
                *[{"label": f"Protocol: {p}", "done": False} for p in protocols],
                *[{"label": f"Stress test: {s}", "done": False} for s in stress_tests],
                *[{"label": f"Repro: {r}", "done": False} for r in repro],
            ],
        })

    updated = len(new_sections)

    # Remove old designspec-sourced sections, keep user-created ones
    preserved = [s for s in sections if not s.get("designspec_source")]
    final_sections = preserved + new_sections

    overview["sections"] = final_sections
    overview["designspec_updated_at"] = ts_now
    write_json(pdir / "content" / "overview.json", overview)
    return updated


PHASE_LABELS = {
    0: "Phase 0 — Setup",
    1: "Phase 1 — Data & Literature",
    2: "Phase 2 — Core Method",
    3: "Phase 3 — Evaluation Harness",
    4: "Phase 4 — Ablations / Stress Tests",
    5: "Phase 5 — Writing / Finalization",
}


def _infer_phase(step: dict, default_for_type: int) -> int:
    """Deterministic phase assignment from designspec_refs and title keywords."""
    # If the DesignSpec explicitly provided a phase, use it
    if "phase" in step and isinstance(step["phase"], int) and 0 <= step["phase"] <= 5:
        return step["phase"]

    refs_lower = " ".join(str(r).lower() for r in step.get("designspec_refs", []))
    title_lower = step.get("title", "").lower() + " " + step.get("goal", "").lower()
    combined = refs_lower + " " + title_lower

    if any(k in combined for k in ("setup", "scaffold", "repo", "ci ", "ci/", "env")):
        return 0
    if any(k in combined for k in ("literature", "survey", "data", "ingest", "corpus", "theme-", "theme ")):
        return 1
    if any(k in combined for k in ("stress", "ablation", "robustness", "perturbation")):
        return 4
    if any(k in combined for k in ("eval", "baseline", "harness", "benchmark", "metric")):
        return 3
    if any(k in combined for k in ("writ", "draft", "paper", "figure", "table", "final", "camera", "submis")):
        return 5
    if any(k in refs_lower for k in ("m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "method")):
        return 2

    return default_for_type


def _apply_execution_updates(pdir: Path, spec: dict) -> tuple[int, int, int, int]:
    """Replace execution steps from DesignSpec with phase grouping and status preservation.
    Returns (old_vc, new_vc, old_vr, new_vr)."""
    import uuid

    ep = spec.get("execution_plan", {})

    # Load existing steps to preserve user statuses
    old_vc_data = read_yaml(pdir / "execution" / "vc_steps.yaml")
    old_vc_steps = old_vc_data.get("steps", [])
    old_vc = len(old_vc_steps)
    vc_status_map = {s["id"]: s.get("status", "todo") for s in old_vc_steps if s.get("id")}

    old_vr_data = read_yaml(pdir / "execution" / "vr_steps.yaml")
    old_vr_steps = old_vr_data.get("steps", [])
    old_vr = len(old_vr_steps)
    vr_status_map = {s["id"]: s.get("status", "todo") for s in old_vr_steps if s.get("id")}

    # Build VC steps with phase
    vc_steps = []
    for s in ep.get("vibe_coding_steps", []):
        sid = s.get("id", str(uuid.uuid4())[:8])
        phase = _infer_phase(s, default_for_type=2)
        vc_steps.append({
            "id": sid,
            "title": s.get("title", ""),
            "description": s.get("goal", ""),
            "acceptance": "; ".join(s.get("acceptance", [])) if isinstance(s.get("acceptance"), list) else s.get("acceptance", ""),
            "section": PHASE_LABELS.get(phase, "Phase 2 — Core Method"),
            "phase": phase,
            "linked_milestone": "",
            "status": vc_status_map.get(sid, "todo"),
            "prompt_hint": s.get("prompt_short", ""),
            "prompt_expanded": s.get("prompt_expanded", ""),
            "designspec_refs": s.get("designspec_refs", []),
            "deliverables": s.get("deliverables", []),
        })
    write_yaml(pdir / "execution" / "vc_steps.yaml", {"steps": vc_steps})

    # Build VR steps with phase
    vr_steps = []
    for s in ep.get("vibe_research_steps", []):
        sid = s.get("id", str(uuid.uuid4())[:8])
        phase = _infer_phase(s, default_for_type=5)
        vr_steps.append({
            "id": sid,
            "title": s.get("title", ""),
            "description": s.get("goal", ""),
            "acceptance": "; ".join(s.get("acceptance", [])) if isinstance(s.get("acceptance"), list) else s.get("acceptance", ""),
            "section": PHASE_LABELS.get(phase, "Phase 5 — Writing / Finalization"),
            "phase": phase,
            "linked_milestone": "",
            "status": vr_status_map.get(sid, "todo"),
            "prompt_hint": s.get("prompt_short", ""),
            "prompt_expanded": s.get("prompt_expanded", ""),
            "designspec_refs": s.get("designspec_refs", []),
            "deliverables": s.get("deliverables", []),
        })
    write_yaml(pdir / "execution" / "vr_steps.yaml", {"steps": vr_steps})

    # Sync to checklists
    _sync_steps_to_checklist(pdir, "vibe_coding", vc_steps)
    _sync_steps_to_checklist(pdir, "vibe_research", vr_steps)

    return old_vc, len(vc_steps), old_vr, len(vr_steps)


def _sync_steps_to_checklist(pdir: Path, cl_name: str, steps: list[dict]) -> None:
    """Sync execution steps to corresponding checklist."""
    cl_path = pdir / "checklists" / f"{cl_name}.yaml"
    items = []
    for s in steps:
        items.append({
            "id": s["id"],
            "section": s.get("section", ""),
            "text": s.get("title", ""),
            "status": s.get("status", "todo"),
            "notes": "",
        })
    write_yaml(cl_path, {"checklist_id": cl_name, "items": items})


def _apply_timeline_updates(pdir: Path, spec: dict) -> tuple[int, int]:
    """Replace milestones from DesignSpec. Returns (old_count, new_count)."""
    old_data = read_yaml(pdir / "timeline" / "milestones.yaml")
    old_count = len(old_data.get("milestones", []))

    tl = spec.get("timeline", {})
    milestones = []
    for m in tl.get("milestones", []):
        milestones.append({
            "id": m.get("id", ""),
            "title": m.get("title", ""),
            "deadline": m.get("target_date", ""),
            "status": "pending",
            "acceptance": "; ".join(m.get("acceptance", [])) if isinstance(m.get("acceptance"), list) else m.get("acceptance", ""),
            "owner": "",
        })
    write_yaml(pdir / "timeline" / "milestones.yaml", {"milestones": milestones})
    return old_count, len(milestones)


def _apply_artifact_updates(pdir: Path, spec: dict) -> tuple[int, int]:
    """Replace/merge artifacts from DesignSpec. Returns (old_count, new_count)."""
    old_data = read_yaml(pdir / "artifacts" / "index.yaml")
    old_count = len(old_data.get("artifacts", []))

    artifacts = []
    for a in spec.get("artifact_plan", []):
        artifacts.append({
            "id": a.get("name", "").lower().replace(" ", "-")[:40],
            "title": a.get("name", ""),
            "type": a.get("type", "report"),
            "description": a.get("description", ""),
            "linked_steps": a.get("linked_steps", []),
            "path": "",
            "created_at": datetime.utcnow().isoformat(),
        })
    write_yaml(pdir / "artifacts" / "index.yaml", {"artifacts": artifacts})
    return old_count, len(artifacts)


@router.post("/{project_id}/designspec/import")
async def import_designspec(project_id: str, file: UploadFile = File(...)):
    """Upload a DesignSpec JSON and apply it to the project."""
    pdir = _project_dir(project_id)

    # Read and parse JSON
    content = await file.read()
    try:
        data = orjson.loads(content)
    except Exception:
        raise HTTPException(400, "Invalid JSON file")

    # Validate
    errors = _validate_designspec(data, project_id)
    if errors:
        raise HTTPException(422, {"errors": errors})

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    # Save the raw DesignSpec
    imports_dir = pdir / "imports"
    imports_dir.mkdir(parents=True, exist_ok=True)
    spec_path = imports_dir / f"designspec_{ts}.json"
    atomic_write(spec_path, content, mode="binary")

    # Create backup
    backup_dir = _backup_project_files(pdir, ts)

    # Apply updates
    overview_updated = _apply_overview_updates(pdir, data)
    old_vc, new_vc, old_vr, new_vr = _apply_execution_updates(pdir, data)
    old_ms, new_ms = _apply_timeline_updates(pdir, data)
    old_art, new_art = _apply_artifact_updates(pdir, data)

    emit_event(project_id, "designspec", "import", f"DesignSpec imported: {new_vc} VC steps, {new_vr} VR steps, {new_ms} milestones", {"type": "designspec"})

    return {
        "status": "ok",
        "backup_path": str(backup_dir.relative_to(settings.data_root)),
        "summary": {
            "overview_sections_updated": overview_updated,
            "vibe_coding_steps": {"before": old_vc, "after": new_vc},
            "vibe_research_steps": {"before": old_vr, "after": new_vr},
            "milestones": {"before": old_ms, "after": new_ms},
            "artifacts": {"before": old_art, "after": new_art},
        },
    }


# ══════════════════════════════════════════════════════════
# C5) DesignSpec-aware prompt helpers (for frontend)
# ══════════════════════════════════════════════════════════

@router.get("/{project_id}/designspec/status")
async def designspec_status(project_id: str):
    """Check if a DesignSpec has been imported for this project."""
    pdir = _project_dir(project_id)
    spec = _load_designspec(pdir)
    if not spec:
        return {"exists": False}

    return {
        "exists": True,
        "schema_version": spec.get("schema_version"),
        "topic": spec.get("topic", {}).get("title", ""),
        "modules_count": len(spec.get("method", {}).get("architecture", {}).get("modules", [])),
        "baselines_count": len(spec.get("evaluation", {}).get("baselines", [])),
        "datasets_count": len(spec.get("evaluation", {}).get("datasets", [])),
    }


@router.get("/{project_id}/designspec/step_context/{step_id}")
async def designspec_step_context(project_id: str, step_id: str):
    """Get DesignSpec context for a specific execution step (for enriched prompts)."""
    pdir = _project_dir(project_id)
    spec = _load_designspec(pdir)
    if not spec:
        return {"exists": False, "context": ""}

    # Find the step in VC or VR plans
    all_steps = (
        spec.get("execution_plan", {}).get("vibe_coding_steps", []) +
        spec.get("execution_plan", {}).get("vibe_research_steps", [])
    )

    step_data = None
    for s in all_steps:
        if s.get("id") == step_id:
            step_data = s
            break

    if not step_data:
        return {"exists": True, "context": "", "step_found": False}

    # Build rich context from DesignSpec refs
    refs = step_data.get("designspec_refs", [])
    context_parts = []

    # Overview summary
    topic = spec.get("topic", {})
    context_parts.append(f"## Project: {topic.get('title', '')}")
    context_parts.append(f"{topic.get('one_line', '')}\n")

    # Method summary
    method = spec.get("method", {})
    if method:
        context_parts.append(f"## Method: {method.get('name', '')}")
        context_parts.append(f"{method.get('problem_definition', '')}\n")

    # Referenced modules
    modules = {m.get("id"): m for m in method.get("architecture", {}).get("modules", [])}
    ref_modules = [modules[r] for r in refs if r in modules]
    if ref_modules:
        context_parts.append("## Relevant Modules")
        for m in ref_modules:
            context_parts.append(f"- **{m['id']}: {m.get('name', '')}** — Inputs: {', '.join(m.get('inputs', []))}; Outputs: {', '.join(m.get('outputs', []))}")
        context_parts.append("")

    # Evaluation summary
    evaluation = spec.get("evaluation", {})
    if evaluation.get("datasets") or evaluation.get("metrics"):
        context_parts.append("## Evaluation Context")
        for d in evaluation.get("datasets", []):
            context_parts.append(f"- Dataset: {d.get('name', '')} ({d.get('source', '')})")
        if evaluation.get("metrics"):
            context_parts.append(f"- Metrics: {', '.join(evaluation['metrics'])}")
        context_parts.append("")

    # Baselines
    if evaluation.get("baselines"):
        context_parts.append("## Baselines")
        for b in evaluation["baselines"]:
            context_parts.append(f"- {b.get('name', '')} ({b.get('type', '')})")
        context_parts.append("")

    return {
        "exists": True,
        "step_found": True,
        "prompt_short": step_data.get("prompt_short", ""),
        "prompt_expanded": step_data.get("prompt_expanded", ""),
        "designspec_refs": refs,
        "context": "\n".join(context_parts),
    }


# ══════════════════════════════════════════════════════════
# C6) Project-scoped VC/VR downloadable prompts
# ══════════════════════════════════════════════════════════

def _load_core_description(pdir: Path) -> str:
    """Load core description text if exists."""
    cd = read_json(pdir / "content" / "core_description.json")
    return cd.get("text", "") if cd else ""


def _build_scoped_execution_prompt(project_id: str, mode: str, pdir: Path) -> str:
    """Build a project-scoped execution prompt (VC or VR) from DesignSpec + core description.
    Falls back to a generic deterministic prompt if no DesignSpec exists."""
    spec = _load_designspec(pdir)
    overview = _load_overview(pdir)
    core_desc = _load_core_description(pdir)
    title = overview.get("title", project_id)

    parts = [f"# {title} — Vibe {'Coding' if mode == 'vc' else 'Research'} Execution Prompt\n"]

    # Project summary
    parts.append("## Project Summary")
    if core_desc:
        parts.append(core_desc[:1000])
    else:
        parts.append(f"Project: {title}")
    parts.append("")

    if not spec:
        # Generic fallback
        parts.append("## Execution Protocol")
        parts.append("No DesignSpec imported yet. Follow this generic protocol:\n")
        if mode == "vc":
            parts.append("1. **PLAN**: List files to touch and changes needed")
            parts.append("2. **IMPLEMENT**: Make changes in small, verifiable diffs")
            parts.append("3. **VERIFY**: Run tests, lint, build after each change")
            parts.append("4. **REPORT**: Write a short summary of what changed and why")
        else:
            parts.append("1. **PLAN**: Define research question and search strategy")
            parts.append("2. **INVESTIGATE**: Search, read, and annotate sources")
            parts.append("3. **SYNTHESIZE**: Summarize findings and identify gaps")
            parts.append("4. **REPORT**: Write structured findings document")
        return "\n".join(parts)

    # Method summary
    method = spec.get("method", {})
    if method:
        parts.append("## Method Summary")
        parts.append(f"**{method.get('name', '')}**: {method.get('problem_definition', '')}\n")
        modules = method.get("architecture", {}).get("modules", [])
        if modules:
            parts.append("### Modules")
            for m in modules:
                parts.append(f"- **{m.get('id', '')}: {m.get('name', '')}** — In: {', '.join(m.get('inputs', []))} → Out: {', '.join(m.get('outputs', []))}")
            parts.append("")
        dataflow = method.get("architecture", {}).get("dataflow", [])
        if dataflow:
            parts.append("### Dataflow")
            for d in dataflow:
                parts.append(f"- {d}")
            parts.append("")

    # Evaluation summary
    evaluation = spec.get("evaluation", {})
    if evaluation:
        parts.append("## Evaluation Plan")
        for d in evaluation.get("datasets", []):
            parts.append(f"- **Dataset**: {d.get('name', '')} ({d.get('source', '')}; {d.get('split', '')})")
        for b in evaluation.get("baselines", []):
            parts.append(f"- **Baseline**: {b.get('name', '')} ({b.get('type', '')}): {b.get('why', '')}")
        if evaluation.get("metrics"):
            parts.append(f"- **Metrics**: {', '.join(evaluation['metrics'])}")
        parts.append("")

    # Phase plan
    ep = spec.get("execution_plan", {})
    step_key = "vibe_coding_steps" if mode == "vc" else "vibe_research_steps"
    steps = ep.get(step_key, [])
    if steps:
        parts.append("## Phase Plan")
        phase_groups: dict[int, list] = {}
        for s in steps:
            p = _infer_phase(s, default_for_type=2 if mode == "vc" else 5)
            phase_groups.setdefault(p, []).append(s)
        for p_num in sorted(phase_groups.keys()):
            label = PHASE_LABELS.get(p_num, f"Phase {p_num}")
            group = phase_groups[p_num]
            parts.append(f"\n### {label} ({len(group)} steps)")
            for s in group:
                parts.append(f"- [{s.get('id', '')}] {s.get('title', '')} — {s.get('goal', '')}")
        parts.append("")

    # Execution protocol
    parts.append("## Execution Protocol")
    if mode == "vc":
        parts.append("For each step, follow PLAN → IMPLEMENT → VERIFY → REPORT:")
        parts.append("1. **PLAN**: List touched files and changes. Check acceptance criteria.")
        parts.append("2. **IMPLEMENT**: Make changes in small diffs. Keep existing tests passing.")
        parts.append("3. **VERIFY**: `rg` to audit, run unit tests, `npm run build` / `pytest`, check lint.")
        parts.append("4. **REPORT**: Write a short step completion note with commands run and results.")
    else:
        parts.append("For each step, follow PLAN → INVESTIGATE → SYNTHESIZE → REPORT:")
        parts.append("1. **PLAN**: Define scope, search terms, and target outputs.")
        parts.append("2. **INVESTIGATE**: Search literature, read and annotate, ground all claims.")
        parts.append("3. **SYNTHESIZE**: Summarize findings, map to claims, identify gaps.")
        parts.append("4. **REPORT**: Write structured markdown with citations and evidence.")
    parts.append("")

    parts.append("## Constraints")
    parts.append("- No external API calls. Deterministic and file-driven only.")
    parts.append("- Keep changes minimal and focused per step.")
    parts.append("- Never delete user edits without explicit instruction.")

    return "\n".join(parts)


@router.get("/{project_id}/prompts/vibe_coding")
async def download_vc_prompt(project_id: str):
    """Download project-scoped Vibe Coding execution prompt (enriched if DesignSpec exists)."""
    pdir = _project_dir(project_id)
    content = _build_scoped_execution_prompt(project_id, "vc", pdir)
    filename = f"{project_id}_vibe_coding_prompt.md"
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{project_id}/prompts/vibe_research")
async def download_vr_prompt(project_id: str):
    """Download project-scoped Vibe Research execution prompt (enriched if DesignSpec exists)."""
    pdir = _project_dir(project_id)
    content = _build_scoped_execution_prompt(project_id, "vr", pdir)
    filename = f"{project_id}_vibe_research_prompt.md"
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
