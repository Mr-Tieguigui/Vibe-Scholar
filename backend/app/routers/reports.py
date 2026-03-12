"""Reports generation router — uses real event stream data."""

from datetime import datetime, timedelta
from collections import Counter
from fastapi import APIRouter
from ..config import settings
from ..schemas import ReportGenRequest, ReportGenResult
from ..utils import read_yaml, read_markdown, write_markdown, read_jsonl, write_json, read_json
from ..events import emit_event, read_events, read_events_for_date, read_events_for_week

router = APIRouter(prefix="/reports", tags=["reports"])


def _load_projects_config() -> list[dict]:
    cfg = read_yaml(settings.config_dir / "projects.yaml")
    return cfg.get("projects", [])


def _summarize_events(events: list[dict]) -> dict:
    """Aggregate events into counts by kind/action."""
    by_kind = Counter(e.get("kind", "?") for e in events)
    by_action = Counter(e.get("action", "?") for e in events)
    by_project = Counter(e.get("project_id", "?") for e in events)
    return {
        "total": len(events),
        "by_kind": dict(by_kind),
        "by_action": dict(by_action),
        "by_project": dict(by_project),
    }


def _generate_daily_content(date_str: str) -> tuple[str, dict]:
    """Generate daily report content from event stream. Returns (markdown, json_summary)."""
    events = read_events_for_date(date_str)
    summary = _summarize_events(events)
    projects = _load_projects_config()
    proj_names = {p["id"]: p.get("name", p["id"]) for p in projects}

    lines = [f"# Daily Report — {date_str}\n"]

    # Summary metrics
    lines.append("## Summary\n")
    lines.append(f"| Metric | Count |")
    lines.append(f"|--------|-------|")
    lines.append(f"| Total events | {summary['total']} |")
    for kind, count in sorted(summary["by_kind"].items()):
        lines.append(f"| {kind} | {count} |")
    lines.append("")

    # Events by project
    by_proj: dict[str, list] = {}
    for e in events:
        pid = e.get("project_id", "global")
        by_proj.setdefault(pid, []).append(e)

    for pid, proj_events in sorted(by_proj.items()):
        name = proj_names.get(pid, pid)
        lines.append(f"## {name}\n")
        for ev in proj_events:
            ts_short = ev.get("ts", "")[-8:] if ev.get("ts") else ""
            kind = ev.get("kind", "?")
            action = ev.get("action", "?")
            lines.append(f"- `{ts_short}` **[{kind}/{action}]** {ev.get('summary', '')}")
        lines.append("")

    if not events:
        lines.append("\n_No activity recorded for this date._\n")

    # Also generate per-project log snippets for additional context
    for p in projects:
        pid = p["id"]
        pdir = settings.projects_dir / pid
        if not pdir.exists():
            continue
        vc_logs = read_jsonl(pdir / "logs" / "vibe_coding.jsonl", limit=10)
        vr_logs = read_jsonl(pdir / "logs" / "vibe_research.jsonl", limit=10)
        today_vc = [l for l in vc_logs if l.get("timestamp", "").startswith(date_str)]
        today_vr = [l for l in vr_logs if l.get("timestamp", "").startswith(date_str)]
        if (today_vc or today_vr) and pid not in by_proj:
            lines.append(f"## {p['name']} (logs)\n")
            for log in today_vc:
                lines.append(f"- **[VC]** {log.get('summary', '')}")
            for log in today_vr:
                lines.append(f"- **[VR]** {log.get('summary', '')}")
            lines.append("")

    md = "\n".join(lines) + "\n"
    return md, summary


def _generate_weekly_content(week_str: str) -> tuple[str, dict]:
    """Generate weekly report from event stream + project metrics."""
    # Parse week
    try:
        year = int(week_str.split("-W")[0])
        week = int(week_str.split("-W")[1])
        events = read_events_for_week(year, week)
    except (ValueError, IndexError):
        events = read_events(limit=200)

    summary = _summarize_events(events)
    projects = _load_projects_config()

    lines = [f"# Weekly Report — {week_str}\n"]

    # Portfolio metrics
    total_vc_pct = []
    total_vr_pct = []
    total_lit = 0
    total_blockers = 0
    total_overdue = 0
    project_lines = []

    for p in projects:
        pid = p["id"]
        pdir = settings.projects_dir / pid
        if not pdir.exists():
            continue
        vc_data = read_yaml(pdir / "checklists" / "vibe_coding.yaml")
        vr_data = read_yaml(pdir / "checklists" / "vibe_research.yaml")
        vc_items = vc_data.get("items", [])
        vr_items = vr_data.get("items", [])
        vc_done = sum(1 for i in vc_items if i.get("status") == "done")
        vr_done = sum(1 for i in vr_items if i.get("status") == "done")
        vc_pct = round(vc_done / len(vc_items) * 100) if vc_items else 0
        vr_pct = round(vr_done / len(vr_items) * 100) if vr_items else 0
        total_vc_pct.append(vc_pct)
        total_vr_pct.append(vr_pct)
        blockers = sum(1 for i in vc_items + vr_items if i.get("status") == "blocked")
        total_blockers += blockers
        ms_data = read_yaml(pdir / "timeline" / "milestones.yaml")
        milestones = ms_data.get("milestones", [])
        ms_done = sum(1 for m in milestones if m.get("status") == "done")
        ms_overdue = sum(1 for m in milestones if m.get("status") == "overdue")
        total_overdue += ms_overdue
        lit_path = pdir / "literature" / "normalized" / "papers.jsonl"
        lit_count = 0
        if lit_path.exists():
            text = lit_path.read_text(encoding="utf-8").strip()
            lit_count = sum(1 for line in text.split("\n") if line.strip()) if text else 0
        total_lit += lit_count
        proj_yaml = read_yaml(pdir / "project.yaml")
        rag = proj_yaml.get("rag", "green")

        project_lines.append(f"### {p['name']}")
        project_lines.append(f"- **RAG:** {rag} | **VC:** {vc_pct}% ({vc_done}/{len(vc_items)}) | **VR:** {vr_pct}% ({vr_done}/{len(vr_items)})")
        project_lines.append(f"- **Milestones:** {ms_done}/{len(milestones)} done | **Literature:** {lit_count} papers")
        if blockers:
            project_lines.append(f"- **{blockers} blocked items**")
        if ms_overdue:
            project_lines.append(f"- **{ms_overdue} overdue milestones**")

        # Events for this project this week
        proj_events = [e for e in events if e.get("project_id") == pid]
        if proj_events:
            project_lines.append(f"- **{len(proj_events)} events this week:**")
            for ev in proj_events[-5:]:
                project_lines.append(f"  - [{ev.get('kind','')}/{ev.get('action','')}] {ev.get('summary','')}")
        project_lines.append("")

    avg_vc = round(sum(total_vc_pct) / len(total_vc_pct)) if total_vc_pct else 0
    avg_vr = round(sum(total_vr_pct) / len(total_vr_pct)) if total_vr_pct else 0

    lines.append("## Portfolio Dashboard\n")
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| Active Projects | {len(projects)} |")
    lines.append(f"| Avg VC Progress | {avg_vc}% |")
    lines.append(f"| Avg VR Progress | {avg_vr}% |")
    lines.append(f"| Total Literature | {total_lit} papers |")
    lines.append(f"| Total Blockers | {total_blockers} |")
    lines.append(f"| Overdue Milestones | {total_overdue} |")
    lines.append(f"| Events This Week | {summary['total']} |")
    lines.append("")

    lines.append("## Event Summary\n")
    for kind, count in sorted(summary["by_kind"].items()):
        lines.append(f"- **{kind}**: {count}")
    lines.append("")

    lines.append("## Project Details\n")
    lines.extend(project_lines)

    md = "\n".join(lines) + "\n"
    return md, summary


@router.post("/daily", response_model=ReportGenResult)
async def generate_daily(req: ReportGenRequest = ReportGenRequest()):
    date_str = req.date or datetime.utcnow().strftime("%Y-%m-%d")
    content, summary = _generate_daily_content(date_str)
    (settings.reports_dir / "daily").mkdir(parents=True, exist_ok=True)
    path = settings.reports_dir / "daily" / f"{date_str}.md"
    write_markdown(path, content)
    write_json(settings.reports_dir / "daily" / f"{date_str}.json", summary)
    emit_event("_system", "report", "generate", f"Daily report generated for {date_str}", {"type": "report", "id": date_str})
    return ReportGenResult(path=str(path), content=content)


@router.post("/weekly", response_model=ReportGenResult)
async def generate_weekly(req: ReportGenRequest = ReportGenRequest()):
    now = datetime.utcnow()
    week_str = req.date or now.strftime("%Y-W%V")
    content, summary = _generate_weekly_content(week_str)
    (settings.reports_dir / "weekly").mkdir(parents=True, exist_ok=True)
    path = settings.reports_dir / "weekly" / f"{week_str}.md"
    write_markdown(path, content)
    write_json(settings.reports_dir / "weekly" / f"{week_str}.json", summary)
    emit_event("_system", "report", "generate", f"Weekly report generated for {week_str}", {"type": "report", "id": week_str})
    return ReportGenResult(path=str(path), content=content)


@router.get("/list")
async def list_reports():
    """List all existing report files."""
    daily_dir = settings.reports_dir / "daily"
    weekly_dir = settings.reports_dir / "weekly"
    daily = []
    weekly = []
    if daily_dir.exists():
        daily = sorted([f.stem for f in daily_dir.glob("*.md")], reverse=True)
    if weekly_dir.exists():
        weekly = sorted([f.stem for f in weekly_dir.glob("*.md")], reverse=True)
    return {"daily": daily, "weekly": weekly}


@router.get("/daily/{date_str}")
async def get_daily(date_str: str):
    path = settings.reports_dir / "daily" / f"{date_str}.md"
    content = read_markdown(path)
    json_path = settings.reports_dir / "daily" / f"{date_str}.json"
    summary = read_json(json_path) if json_path.exists() else {}
    events = read_events_for_date(date_str)
    return {"content": content, "summary": summary, "events": events}


@router.get("/weekly/{week_str}")
async def get_weekly(week_str: str):
    path = settings.reports_dir / "weekly" / f"{week_str}.md"
    content = read_markdown(path)
    json_path = settings.reports_dir / "weekly" / f"{week_str}.json"
    summary = read_json(json_path) if json_path.exists() else {}
    now = datetime.utcnow()
    try:
        parts = week_str.split("-W")
        year = int(parts[0])
        week = int(parts[1])
    except Exception:
        year, week = now.isocalendar()[0], now.isocalendar()[1]
    events = read_events_for_week(year, week)
    return {"content": content, "summary": summary, "events": events}


@router.get("/events")
async def get_recent_events(limit: int = 20):
    """Return recent events for the activity feed."""
    events = read_events(limit=limit)
    events.reverse()  # newest first
    return events


@router.get("/today_summary")
async def get_today_summary():
    """Quick summary for today's activity — used by Home page strip."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    events = read_events_for_date(today)
    summary = _summarize_events(events)
    return {"date": today, **summary}


@router.get("/week_summary")
async def get_week_summary():
    """Quick summary for current week's activity — used by Home page strip."""
    now = datetime.utcnow()
    year = now.isocalendar()[0]
    week = now.isocalendar()[1]
    events = read_events_for_week(year, week)
    summary = _summarize_events(events)
    return {"week": f"{year}-W{week:02d}", **summary}
