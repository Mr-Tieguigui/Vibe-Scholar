"""VibeScholar — FastAPI backend with production frontend serving."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings
from .schemas import HealthResponse
from .routers import projects, literature, reports, designspec


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure data directories exist on startup
    for d in [
        settings.config_dir,
        settings.projects_dir,
        settings.literature_dir / "raw",
        settings.literature_dir / "normalized",
        settings.literature_dir / "papers",
        settings.reports_dir / "daily",
        settings.reports_dir / "weekly",
        settings.data_root / "reports" / "implementation_notes",
    ]:
        d.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="VibeScholar",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routes ───────────────────────────────────────────
app.include_router(projects.router, prefix=settings.api_prefix)
app.include_router(literature.router, prefix=settings.api_prefix)
app.include_router(reports.router, prefix=settings.api_prefix)
app.include_router(designspec.router, prefix=settings.api_prefix)


@app.get(f"{settings.api_prefix}/health", response_model=HealthResponse)
async def health():
    return HealthResponse()


# ── Template endpoints ──────────────────────────────────
@app.get(f"{settings.api_prefix}/templates/project_content")
async def download_template():
    """Download the VibeScholar project JSON prompt template."""
    template_path = settings.data_root / "templates" / "vibeops_project_template.json"
    if not template_path.exists():
        # Fallback to legacy YAML
        template_path = settings.data_root / "templates" / "project_content_template.yaml"
    if not template_path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, "Template file not found")
    from fastapi.responses import Response
    content = template_path.read_text(encoding="utf-8")
    media = "application/json" if template_path.suffix == ".json" else "application/x-yaml"
    fname = template_path.name
    return Response(
        content=content,
        media_type=media,
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


# ── Prompt template download ─────────────────────────────
from fastapi import Body, Query

@app.get(f"{settings.api_prefix}/projects/{{project_id}}/templates/prompt")
async def download_prompt_template(project_id: str, mode: str = Query("personalized")):
    """Download a personalized or generic prompt template as Markdown."""
    from fastapi import HTTPException
    from fastapi.responses import Response
    from .utils import read_json

    pdir = settings.projects_dir / project_id
    if not pdir.exists():
        raise HTTPException(404, f"Project {project_id} not found")

    master_path = settings.data_root / "templates" / "prompt" / "project_filled_template_prompt.md"
    if not master_path.exists():
        raise HTTPException(404, "Master prompt template not found")

    content = master_path.read_text(encoding="utf-8")

    if mode == "personalized":
        core_path = pdir / "content" / "core_description.json"
        if core_path.exists():
            core_data = read_json(core_path)
            user_text = core_data.get("text", "").strip()
        else:
            user_text = ""
        if user_text:
            injection = f"---BEGIN CORE DESCRIPTION---\n{user_text}\n---END CORE DESCRIPTION---"
        else:
            injection = "---BEGIN CORE DESCRIPTION---\n(No core description saved yet. Please save one first for a personalized prompt.)\n---END CORE DESCRIPTION---"
    else:
        injection = "---BEGIN CORE DESCRIPTION---\n(not provided)\n---END CORE DESCRIPTION---"

    content = content.replace("{{CORE_DESCRIPTION}}", injection)

    fname = f"{project_id}_template_prompt.md"
    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@app.get(f"{settings.api_prefix}/templates/prompt/vibe_coding")
async def download_vc_prompt_template():
    """Download the Vibe Coding prompt template."""
    from fastapi.responses import Response
    path = settings.data_root / "templates" / "prompt" / "vibe_coding_prompt_template.md"
    if not path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, "Vibe Coding prompt template not found")
    return Response(
        content=path.read_text(encoding="utf-8"),
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="vibe_coding_prompt_template.md"'},
    )


@app.get(f"{settings.api_prefix}/templates/prompt/vibe_research")
async def download_vr_prompt_template():
    """Download the Vibe Research prompt template."""
    from fastapi.responses import Response
    path = settings.data_root / "templates" / "prompt" / "vibe_research_prompt_template.md"
    if not path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, "Vibe Research prompt template not found")
    return Response(
        content=path.read_text(encoding="utf-8"),
        media_type="text/markdown",
        headers={"Content-Disposition": 'attachment; filename="vibe_research_prompt_template.md"'},
    )


@app.get(f"{settings.api_prefix}/templates/schema/filled_template")
async def download_filled_template_schema():
    """Download the JSON schema for filled templates."""
    from fastapi.responses import Response
    path = settings.data_root / "templates" / "schema" / "filled_template_schema.json"
    if not path.exists():
        from fastapi import HTTPException
        raise HTTPException(404, "Schema file not found")
    return Response(
        content=path.read_text(encoding="utf-8"),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="filled_template_schema.json"'},
    )


@app.post(f"{settings.api_prefix}/projects/{{project_id}}/import_template")
async def import_template_content(project_id: str, template: dict = Body(...)):
    """Import a parsed template dict and generate all project sections."""
    from fastapi import HTTPException
    from .utils import write_yaml, write_json, write_markdown
    from .overview_parser import parse_overview_md
    from .overview_builder import build_overview_from_template
    from .step_generator import generate_execution_steps
    from .template_validator import validate_template, clean_template

    pdir = settings.projects_dir / project_id
    if not pdir.exists():
        raise HTTPException(404, f"Project {project_id} not found")

    # Validate template
    errors = validate_template(template)
    if errors:
        raise HTTPException(422, detail={"errors": errors, "message": f"Template validation failed with {len(errors)} error(s)"})

    # Strip internal keys
    template = clean_template(template)

    overview_sections = template.get("overview", {})
    generated = {}

    # Generate overview.md
    title = template.get("name", template.get("name_en", "Untitled"))
    md_lines = [f"# {title}\n"]
    section_order = [
        "definition", "motivation", "scope", "questions", "concepts",
        "pipeline", "evaluation", "deliverables", "milestones", "risks",
        "literature", "next_actions",
    ]
    for sec in section_order:
        content = overview_sections.get(sec, "")
        if not content:
            continue
        heading = sec.replace("_", " ").title()
        md_lines.append(f"\n## {heading}\n")
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict):
                    # Handle different dict formats
                    if "term" in item:
                        md_lines.append(f"- **{item['term']}:** {item.get('description', '')}")
                    elif "step" in item:
                        md_lines.append(f"1. **{item['step']}:** {item.get('description', '')}")
                    elif "label" in item:
                        md_lines.append(f"- **{item['label']}:** {item.get('value', '')}")
                    elif "id" in item:
                        md_lines.append(f"- **{item.get('id', '')}**: {item.get('title', '')}")
                        if item.get("acceptance"):
                            md_lines.append(f"  - Acceptance: {item['acceptance']}")
                        if item.get("week"):
                            md_lines.append(f"  - Timeline: {item['week']}")
                    elif "risk" in item:
                        md_lines.append(f"- **{item['risk']}** → Mitigation: {item.get('mitigation', '')}")
                    else:
                        md_lines.append(f"- {item}")
                else:
                    md_lines.append(f"- {item}")
        elif isinstance(content, str):
            md_lines.append(content.strip())
    md_lines.append("")
    overview_md = "\n".join(md_lines)

    (pdir / "content").mkdir(parents=True, exist_ok=True)
    write_markdown(pdir / "content" / "overview.md", overview_md)
    generated["overview_md"] = True

    # Build structured overview.json directly from template (no lossy md→json round-trip)
    overview = build_overview_from_template(template)

    write_json(pdir / "content" / "overview.json", overview)
    generated["overview_json"] = True
    generated["overview_sections"] = len(overview.get("sections", []))

    # Generate execution steps — prefer template-provided, fallback to auto-gen
    (pdir / "execution").mkdir(parents=True, exist_ok=True)
    tpl_exec = template.get("execution", {})
    if isinstance(tpl_exec, dict) and (tpl_exec.get("vc_steps") or tpl_exec.get("vr_steps")):
        # Use template-provided steps
        vc_raw = tpl_exec.get("vc_steps", [])
        vr_raw = tpl_exec.get("vr_steps", [])
        import uuid as _uuid
        def _enrich_steps(raw_steps: list) -> list:
            enriched = []
            for s in raw_steps:
                if isinstance(s, dict) and s.get("title"):
                    enriched.append({
                        "id": s.get("id", _uuid.uuid4().hex[:8]),
                        "title": s["title"],
                        "description": s.get("description", ""),
                        "acceptance": s.get("acceptance", ""),
                        "section": s.get("section", "default"),
                        "status": "todo",
                        "prompt_hint": s.get("prompt_hint", ""),
                        "linked_milestone": s.get("linked_milestone", ""),
                    })
            return enriched
        vc_steps = _enrich_steps(vc_raw)
        vr_steps = _enrich_steps(vr_raw)
    else:
        step_result = generate_execution_steps(overview)
        vc_steps = step_result["vc_steps"]
        vr_steps = step_result["vr_steps"]
    write_yaml(pdir / "execution" / "vc_steps.yaml", {"steps": vc_steps})
    write_yaml(pdir / "execution" / "vr_steps.yaml", {"steps": vr_steps})
    generated["vc_steps"] = len(vc_steps)
    generated["vr_steps"] = len(vr_steps)

    # Generate timeline
    (pdir / "timeline").mkdir(parents=True, exist_ok=True)
    sections_map = {s["type"]: s for s in overview.get("sections", [])}
    milestone_items = sections_map.get("milestones", {}).get("items", [])
    deliverables_items = sections_map.get("deliverables", {}).get("items", [])

    timeline_milestones = []
    for i, m in enumerate(milestone_items):
        if isinstance(m, dict):
            timeline_milestones.append({
                "id": m.get("id", f"M{i+1}"),
                "title": m.get("title", ""),
                "deadline": m.get("week", ""),
                "status": "pending",
                "acceptance": m.get("acceptance", ""),
                "owner": "",
            })
    write_yaml(pdir / "timeline" / "milestones.yaml", {"milestones": timeline_milestones})
    generated["milestones"] = len(timeline_milestones)

    # Kanban is a projection of milestones — no separate file needed

    # Mark template as imported
    import datetime as _dt
    ts = _dt.datetime.utcnow().isoformat()

    # Artifacts — use template-provided or create skeleton
    (pdir / "artifacts").mkdir(parents=True, exist_ok=True)
    artifacts_path = pdir / "artifacts" / "index.yaml"
    tpl_artifacts = template.get("artifacts", [])
    if isinstance(tpl_artifacts, list) and any(isinstance(a, dict) and a.get("name") for a in tpl_artifacts):
        import uuid as _uuid2
        art_items = []
        for a in tpl_artifacts:
            if isinstance(a, dict) and a.get("name"):
                art_items.append({
                    "id": _uuid2.uuid4().hex[:8],
                    "type": a.get("type", "other"),
                    "name": a["name"],
                    "path": a.get("path", ""),
                    "description": a.get("description", ""),
                    "linked_milestone": a.get("linked_step", ""),
                    "created_at": ts,
                })
        write_yaml(artifacts_path, {"artifacts": art_items})
        generated["artifacts"] = len(art_items)
    elif not artifacts_path.exists():
        write_yaml(artifacts_path, {"artifacts": []})
    write_yaml(pdir / "template_imported.yaml", {"imported": True, "timestamp": ts})

    # Write import log
    (pdir / "imports").mkdir(parents=True, exist_ok=True)
    log_lines = [
        f"# Template Import Log — {ts}\n",
        f"**Project:** {project_id}\n",
        f"**Template sections provided:** {', '.join(k for k in overview_sections.keys()) or 'none'}\n",
        "## Generated Artifacts\n",
    ]
    for key, val in generated.items():
        log_lines.append(f"- **{key}:** {val}")
    log_lines.append(f"\n## Overview Sections Parsed: {len(overview.get('sections', []))}\n")
    for sec in overview.get("sections", []):
        stype = sec.get("type", "unknown")
        items_count = len(sec.get("items", sec.get("steps", [])))
        log_lines.append(f"- {stype}: {items_count} items")
    log_lines.append("")
    log_name = f"import_log_{ts.replace(':', '-').replace('.', '-')}.md"
    write_markdown(pdir / "imports" / log_name, "\n".join(log_lines))
    generated["import_log"] = log_name

    return {"status": "ok", "project_id": project_id, "generated": generated}


# ── Maintenance endpoints ────────────────────────────────
@app.post(f"{settings.api_prefix}/maintenance/reindex-literature")
async def reindex_literature():
    """Rebuild the global papers.jsonl from all per-project literature stores."""
    import orjson
    from .utils import atomic_write, read_yaml

    global_papers: dict[str, dict] = {}
    papers_dir = settings.literature_dir / "papers"

    # Collect from per-project stores
    if settings.projects_dir.exists():
        for proj in settings.projects_dir.iterdir():
            jsonl_path = proj / "literature" / "normalized" / "papers.jsonl"
            if jsonl_path.exists():
                for line in jsonl_path.read_text(encoding="utf-8").strip().split("\n"):
                    if line.strip():
                        p = orjson.loads(line)
                        pid = p.get("paper_id", "")
                        if pid and pid not in global_papers:
                            global_papers[pid] = p

    # Also collect from global papers dir metadata
    if papers_dir.exists():
        for pdir in papers_dir.iterdir():
            if pdir.is_dir() and (pdir / "meta.yaml").exists():
                meta = read_yaml(pdir / "meta.yaml")
                pid = meta.get("paper_id", pdir.name)
                if pid not in global_papers:
                    global_papers[pid] = meta

    # Write rebuilt global index
    norm_dir = settings.literature_dir / "normalized"
    norm_dir.mkdir(parents=True, exist_ok=True)
    content = "\n".join(orjson.dumps(p).decode("utf-8") for p in global_papers.values()) + "\n"
    atomic_write(norm_dir / "papers.jsonl", content)

    return {"status": "ok", "papers_indexed": len(global_papers)}


@app.post(f"{settings.api_prefix}/maintenance/rebuild-cache")
async def rebuild_cache():
    """Regenerate all derived data (overview.json, steps, timeline) for all projects."""
    from .utils import read_yaml, read_markdown, read_json, write_json, write_yaml, write_markdown
    from .overview_parser import parse_overview_md
    from .step_generator import generate_execution_steps

    cfg = read_yaml(settings.config_dir / "projects.yaml")
    project_list = cfg.get("projects", [])
    results = {}

    for p in project_list:
        pid = p["id"]
        pdir = settings.projects_dir / pid
        if not pdir.exists():
            continue

        # 1. Overview: parse md → json if json missing
        json_path = pdir / "content" / "overview.json"
        if not json_path.exists():
            md = read_markdown(pdir / "content" / "overview.md")
            if md:
                overview = parse_overview_md(md)
                write_json(json_path, overview)

        # Read overview for downstream generation
        overview = read_json(json_path) if json_path.exists() else {}
        if not overview:
            results[pid] = "skipped (no overview)"
            continue

        # 2. Execution steps
        step_result = generate_execution_steps(overview)
        (pdir / "execution").mkdir(parents=True, exist_ok=True)
        write_yaml(pdir / "execution" / "vc_steps.yaml", {"steps": step_result["vc_steps"]})
        write_yaml(pdir / "execution" / "vr_steps.yaml", {"steps": step_result["vr_steps"]})

        # 3. Timeline
        sections = {s["type"]: s for s in overview.get("sections", [])}
        milestone_items = sections.get("milestones", {}).get("items", [])
        deliverables = sections.get("deliverables", {}).get("items", [])

        import uuid
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

        # Kanban is a projection of milestones — no separate file needed

        results[pid] = "rebuilt"

    return {"status": "ok", "projects": results}


@app.get(f"{settings.api_prefix}/maintenance/export-summary")
async def export_summary():
    """Export a summary of all project data for backup/audit."""
    from .utils import read_yaml
    import orjson

    cfg = read_yaml(settings.config_dir / "projects.yaml")
    project_list = cfg.get("projects", [])
    summary = {"projects": [], "total_papers": 0}

    for p in project_list:
        pid = p["id"]
        pdir = settings.projects_dir / pid
        if not pdir.exists():
            continue

        proj = {"id": pid, "name": p.get("name", "")}

        # Checklists
        vc = read_yaml(pdir / "checklists" / "vibe_coding.yaml")
        vr = read_yaml(pdir / "checklists" / "vibe_research.yaml")
        vc_items = vc.get("items", [])
        vr_items = vr.get("items", [])
        proj["vc_total"] = len(vc_items)
        proj["vc_done"] = sum(1 for i in vc_items if i.get("status") == "done")
        proj["vr_total"] = len(vr_items)
        proj["vr_done"] = sum(1 for i in vr_items if i.get("status") == "done")

        # Literature
        lit_path = pdir / "literature" / "normalized" / "papers.jsonl"
        proj["literature_count"] = 0
        if lit_path.exists():
            proj["literature_count"] = sum(1 for l in lit_path.read_text().strip().split("\n") if l.strip())
        summary["total_papers"] += proj["literature_count"]

        # Milestones
        ms = read_yaml(pdir / "timeline" / "milestones.yaml")
        proj["milestones_total"] = len(ms.get("milestones", []))
        proj["milestones_done"] = sum(1 for m in ms.get("milestones", []) if m.get("status") == "done")

        # Artifacts
        arts = read_yaml(pdir / "artifacts" / "index.yaml")
        proj["artifacts_count"] = len(arts.get("artifacts", []))

        summary["projects"].append(proj)

    return summary


# ── Landing page: serve static page template ─────────────
page_dir = settings.data_root / "page" / "Academic-project-page-template"
if page_dir.exists():
    app.mount("/page", StaticFiles(directory=str(page_dir), html=True), name="landing-page")

# ── Production: serve built frontend ─────────────────────
dist = settings.frontend_dist
if dist.exists() and (dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(dist / "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Try to serve the file directly first
        file_path = dist / full_path
        if full_path and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        # Fallback to index.html for SPA routing
        return FileResponse(str(dist / "index.html"))
