"""Literature import, search, and notes router."""

import csv
import io
import re
import hashlib
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from ..config import settings
from ..schemas import PaperMeta, PaperNotes, LiteratureImportResult
from ..utils import read_yaml, write_yaml, read_markdown, write_markdown, atomic_write
from ..events import emit_event
from ..tag_taxonomy import auto_tag_paper

import orjson

router = APIRouter(prefix="/literature", tags=["literature"])


# ── Column mapping: flexible CSV field detection ─────────
# Undermind-first columns (also generic)
FIELD_MAP_UNDERMIND = {
    "title": ["Title", "title", "TITLE", "paper_title", "Paper Title"],
    "authors": ["Authors", "authors", "AUTHORS", "Author", "author"],
    "year": ["Year", "year", "YEAR", "Publication Year", "pub_year"],
    "venue": ["Journal", "journal", "Venue", "venue", "Conference", "conference", "Source"],
    "doi": ["DOI", "doi", "Doi"],
    "url": ["Link", "link", "URL", "url", "Paper URL"],
    "abstract": ["Abstract", "abstract", "ABSTRACT", "Summary"],
    "citation_count": ["Citation Count", "citation_count", "Citations", "citations", "Cited By"],
    "date": ["Date", "date", "Publication Date", "pub_date"],
    "is_open_access": ["Is Open Access", "is_open_access", "Open Access", "OA"],
    "open_access_link": ["Open Access Link", "open_access_link", "OA Link"],
    "semantic_scholar_id": ["Semantic Scholar ID", "semantic_scholar_id", "S2 ID"],
    "relevance_summary": ["Relevance Summary", "relevance_summary", "Relevance"],
    "topic_match_score": ["Topic Match Score", "topic_match_score", "Match Score"],
    "notes": ["Notes", "notes", "Comment", "comment"],
    "tags": ["Tags", "tags", "Keywords", "keywords"],
}

# Zotero-specific column mapping
FIELD_MAP_ZOTERO = {
    "title": ["Title"],
    "authors": ["Author"],
    "year": ["Publication Year"],
    "venue": ["Publication Title", "Journal Abbreviation", "Conference Name"],
    "doi": ["DOI"],
    "url": ["Url", "URL"],
    "abstract": ["Abstract Note"],
    "citation_count": [],
    "date": ["Date", "Date Added"],
    "is_open_access": [],
    "open_access_link": [],
    "semantic_scholar_id": [],
    "relevance_summary": [],
    "topic_match_score": [],
    "notes": ["Notes", "Extra"],
    "tags": ["Manual Tags", "Automatic Tags"],
    # Zotero-only fields
    "item_type": ["Item Type"],
    "key": ["Key"],
    "isbn": ["ISBN"],
    "issn": ["ISSN"],
    "publisher": ["Publisher"],
    "language": ["Language"],
    "pages": ["Pages"],
    "volume": ["Volume"],
    "issue": ["Issue"],
    "short_title": ["Short Title"],
}

FIELD_MAP = FIELD_MAP_UNDERMIND  # default


def _detect_csv_format(row_keys: list[str]) -> str:
    """Auto-detect CSV format from column headers."""
    zotero_markers = {"Key", "Item Type", "Abstract Note", "Publication Title", "Manual Tags"}
    undermind_markers = {"Relevance Summary", "Topic Match Score", "Semantic Scholar ID"}
    keys_set = set(row_keys)
    zotero_hits = len(keys_set & zotero_markers)
    undermind_hits = len(keys_set & undermind_markers)
    if zotero_hits >= 2:
        return "zotero"
    if undermind_hits >= 1:
        return "undermind"
    return "undermind"  # default


def _detect_field(row_keys: list[str], field: str, field_map: dict | None = None) -> str | None:
    """Find the CSV column name that maps to our internal field."""
    fm = field_map or FIELD_MAP
    for candidate in fm.get(field, []):
        if candidate in row_keys:
            return candidate
    return None


def _paper_id_from_title(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower().strip())[:60].strip("-")
    h = hashlib.md5(title.encode()).hexdigest()[:6]
    return f"{slug}-{h}"


def _normalized_path() -> Path:
    return settings.literature_dir / "normalized" / "papers.jsonl"


def _papers_dir() -> Path:
    return settings.literature_dir / "papers"


def _load_all_papers() -> list[dict]:
    path = _normalized_path()
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").strip().split("\n")
    return [orjson.loads(l) for l in lines if l.strip()]


def _save_all_papers(papers: list[dict]) -> None:
    content = "\n".join(orjson.dumps(p).decode("utf-8") for p in papers) + "\n"
    atomic_write(_normalized_path(), content)


def _load_project_papers(project_id: str) -> list[dict]:
    pdir = settings.projects_dir / project_id / "literature" / "normalized"
    path = pdir / "papers.jsonl"
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").strip().split("\n")
    return [orjson.loads(l) for l in lines if l.strip()]


def _save_project_papers(project_id: str, papers: list[dict]) -> None:
    pdir = settings.projects_dir / project_id / "literature" / "normalized"
    pdir.mkdir(parents=True, exist_ok=True)
    content = "\n".join(orjson.dumps(p).decode("utf-8") for p in papers) + "\n"
    atomic_write(pdir / "papers.jsonl", content)


# ── Auto-tagging heuristic (16-domain taxonomy) ──────────
def _auto_tag(title: str, abstract: str, venue: str) -> list[str]:
    """Deterministic keyword-based auto-tagging using 16-domain taxonomy.
    Returns 1-3 domain tags or ['General']."""
    return auto_tag_paper(title, abstract, venue)


def _parse_csv_to_papers(csv_text: str, project_id: str = "", csv_format: str = "auto") -> LiteratureImportResult:
    """Parse CSV text into papers, store in global + optional project scope.
    
    csv_format: 'auto' | 'undermind' | 'zotero'
    """
    global_papers = _load_all_papers()
    global_ids = {p["paper_id"] for p in global_papers}

    proj_papers = _load_project_papers(project_id) if project_id else []
    proj_ids = {p["paper_id"] for p in proj_papers}

    imported = 0
    duplicates = 0
    errors = 0

    reader = csv.DictReader(io.StringIO(csv_text))
    row_keys = reader.fieldnames or []

    # Determine format and field map
    if csv_format == "auto":
        csv_format = _detect_csv_format(row_keys)
    field_map = FIELD_MAP_ZOTERO if csv_format == "zotero" else FIELD_MAP_UNDERMIND

    # Build column mapping
    col = {}
    for field in FIELD_MAP_UNDERMIND:  # iterate all standard fields
        col[field] = _detect_field(row_keys, field, field_map)
    # Also check Zotero-only extras if zotero format
    if csv_format == "zotero":
        for field in FIELD_MAP_ZOTERO:
            if field not in col:
                col[field] = _detect_field(row_keys, field, FIELD_MAP_ZOTERO)

    for row in reader:
        try:
            title_col = col.get("title")
            title = row.get(title_col, "").strip() if title_col else ""
            if not title:
                errors += 1
                continue

            pid = _paper_id_from_title(title)

            # Check project-scope dedup
            if project_id and pid in proj_ids:
                duplicates += 1
                continue
            if not project_id and pid in global_ids:
                duplicates += 1
                continue

            def _get(field: str, default: str = "") -> str:
                c = col.get(field)
                return row.get(c, default).strip() if c else default

            def _get_int(field: str) -> int | None:
                v = _get(field)
                return int(v) if v else None

            def _get_float(field: str) -> float | None:
                v = _get(field)
                return float(v) if v else None

            abstract_raw = _get("abstract")
            tags_raw = _get("tags")
            # Zotero tags use semicolons; Undermind uses commas
            if tags_raw and ";" in tags_raw:
                tag_list = [t.strip() for t in tags_raw.split(";") if t.strip()]
            else:
                tag_list = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

            # Auto-tag: deterministic keyword heuristic if no tags
            if not tag_list:
                tag_list = _auto_tag(title, abstract_raw, _get("venue"))

            paper = PaperMeta(
                paper_id=pid,
                title=title,
                authors=_get("authors"),
                year=_get_int("year"),
                date=_get("date"),
                journal=_get("venue"),
                citation_count=_get_int("citation_count"),
                doi=_get("doi"),
                link=_get("url"),
                is_open_access=_get("is_open_access").lower() in ("true", "yes", "1"),
                open_access_link=_get("open_access_link"),
                semantic_scholar_id=_get("semantic_scholar_id"),
                abstract=abstract_raw,
                relevance_summary=_get("relevance_summary"),
                topic_match_score=_get_float("topic_match_score"),
                tags=tag_list,
                projects=[project_id] if project_id else [],
            )

            paper_dict = paper.model_dump()

            # Add to global store if not already there
            if pid not in global_ids:
                global_papers.append(paper_dict)
                global_ids.add(pid)

            # Add to project store
            if project_id and pid not in proj_ids:
                proj_papers.append(paper_dict)
                proj_ids.add(pid)

            # Create per-paper folder in global literature dir
            ppdir = _papers_dir() / pid
            ppdir.mkdir(parents=True, exist_ok=True)
            write_yaml(ppdir / "meta.yaml", {
                "paper_id": pid, "title": title,
                "authors": paper.authors, "year": paper.year,
                "journal": paper.journal, "doi": paper.doi,
                "link": paper.link,
            })
            write_markdown(ppdir / "abstract.md", f"# {title}\n\n{abstract_raw}\n")
            if not (ppdir / "notes.md").exists():
                write_markdown(ppdir / "notes.md", f"# Notes: {title}\n\n## Key Claims\n\n## Methods\n\n## Relevance\n\n")

            tag_path = ppdir / "tags.yaml"
            existing_tags = read_yaml(tag_path) if tag_path.exists() else {}
            existing_projects = existing_tags.get("projects", [])
            if project_id and project_id not in existing_projects:
                existing_projects.append(project_id)
            write_yaml(tag_path, {
                "tags": tag_list or existing_tags.get("tags", []),
                "projects": existing_projects,
                "pinned": existing_tags.get("pinned", False),
            })

            imported += 1
        except Exception:
            errors += 1

    _save_all_papers(global_papers)
    if project_id:
        _save_project_papers(project_id, proj_papers)

    return LiteratureImportResult(
        total=imported + duplicates + errors,
        imported=imported, duplicates=duplicates, errors=errors,
    )


# ── Tag taxonomy endpoint ─────────────────────────────────
@router.get("/tags/taxonomy")
async def get_tag_taxonomy():
    """Return the 16-domain tag taxonomy for UI dropdowns and chips."""
    from ..tag_taxonomy import DOMAIN_TAXONOMY
    return {"domains": list(DOMAIN_TAXONOMY.keys())}


# ── Global stats ─────────────────────────────────────────
@router.get("/stats")
async def literature_stats():
    """Global literature summary for the Home page."""
    papers = _load_all_papers()
    total = len(papers)
    citations = sum(p.get("citation_count") or 0 for p in papers)
    has_citations = any(p.get("citation_count") for p in papers)

    # Count sources
    raw_dir = settings.literature_dir / "raw"
    source_count = len(list(raw_dir.glob("*.csv"))) if raw_dir.exists() else 0
    # Also count per-project sources
    if settings.projects_dir.exists():
        for proj in settings.projects_dir.iterdir():
            src_dir = proj / "literature" / "sources"
            if src_dir.exists():
                source_count += len(list(src_dir.glob("*")))

    # Last import timestamp
    last_import = None
    if settings.projects_dir.exists():
        for proj in settings.projects_dir.iterdir():
            src_dir = proj / "literature" / "sources"
            if src_dir.exists():
                for f in src_dir.iterdir():
                    mtime = f.stat().st_mtime
                    if last_import is None or mtime > last_import:
                        last_import = mtime

    # Per-project paper counts (top 5)
    project_counts: dict[str, int] = {}
    if settings.projects_dir.exists():
        for proj in settings.projects_dir.iterdir():
            jsonl = proj / "literature" / "normalized" / "papers.jsonl"
            if jsonl.exists():
                count = sum(1 for l in jsonl.read_text().strip().split("\n") if l.strip())
                if count > 0:
                    project_counts[proj.name] = count

    top_projects = sorted(project_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_papers": total,
        "citations_total": citations if has_citations else None,
        "sources_count": source_count,
        "last_import": datetime.fromtimestamp(last_import).isoformat() if last_import else None,
        "top_projects": [{"id": pid, "count": c} for pid, c in top_projects],
    }


# ── Per-project stats ────────────────────────────────────
@router.get("/projects/{project_id}/stats")
async def project_literature_stats(project_id: str):
    papers = _load_project_papers(project_id)
    citations = sum(p.get("citation_count") or 0 for p in papers)
    has_citations = any(p.get("citation_count") for p in papers)
    tags: dict[str, int] = {}
    for p in papers:
        for t in p.get("tags", []):
            tags[t] = tags.get(t, 0) + 1
    return {
        "total_papers": len(papers),
        "citations_total": citations if has_citations else None,
        "top_tags": sorted(tags.items(), key=lambda x: x[1], reverse=True)[:10],
    }


# ── Global Import (legacy) ───────────────────────────────
@router.post("/import", response_model=LiteratureImportResult)
async def import_literature():
    csv_path = settings.literature_dir / "raw" / "table-export.csv"
    if not csv_path.exists():
        raise HTTPException(404, "table-export.csv not found in data/literature/raw/")
    csv_text = csv_path.read_text(encoding="utf-8")
    return _parse_csv_to_papers(csv_text)


# ── Global CSV upload ────────────────────────────────────
@router.post("/import_csv", response_model=LiteratureImportResult)
async def import_csv_global(file: UploadFile = File(...), csv_format: str = Form("auto")):
    """Upload a CSV file to the global literature store.
    
    csv_format: 'auto' | 'undermind' | 'zotero'
    """
    content = await file.read()
    csv_text = content.decode("utf-8")

    # Store raw CSV
    raw_dir = settings.literature_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    fname = re.sub(r"[^a-zA-Z0-9._-]", "_", file.filename or "upload")
    raw_path = raw_dir / f"{ts}_{fname}"
    raw_path.write_text(csv_text, encoding="utf-8")

    return _parse_csv_to_papers(csv_text, csv_format=csv_format)


# ── Per-project CSV upload ───────────────────────────────
@router.post("/projects/{project_id}/import_csv", response_model=LiteratureImportResult)
async def import_project_csv(project_id: str, file: UploadFile = File(...), source_name: str = Form(""), csv_format: str = Form("auto")):
    """Upload a CSV file to a project's literature store.
    
    csv_format: 'auto' | 'undermind' | 'zotero'
    """
    pdir = settings.projects_dir / project_id
    if not pdir.exists():
        raise HTTPException(404, f"Project {project_id} not found")

    content = await file.read()
    csv_text = content.decode("utf-8")

    # Store raw CSV
    sources_dir = pdir / "literature" / "sources"
    sources_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    fname = source_name or file.filename or "upload"
    fname = re.sub(r"[^a-zA-Z0-9._-]", "_", fname)
    raw_path = sources_dir / f"{ts}_{fname}"
    raw_path.write_text(csv_text, encoding="utf-8")

    result = _parse_csv_to_papers(csv_text, project_id=project_id, csv_format=csv_format)
    emit_event(project_id, "literature", "import", f"CSV imported: {result.imported} papers ({result.duplicates} dups)", {"type": "literature", "id": fname})
    return result


# ── Per-project papers list ──────────────────────────────
@router.get("/projects/{project_id}/papers", response_model=list[PaperMeta])
async def get_project_papers(project_id: str, query: str = "", tag: str = "", year: int = 0, limit: int = 100):
    papers = _load_project_papers(project_id)
    results = []
    for p in papers:
        ppdir = _papers_dir() / p["paper_id"]
        tag_data = read_yaml(ppdir / "tags.yaml") if ppdir.exists() else {}
        p["tags"] = tag_data.get("tags", p.get("tags", []))
        p["projects"] = tag_data.get("projects", p.get("projects", []))
        p["pinned"] = tag_data.get("pinned", p.get("pinned", False))

        if tag and tag not in p["tags"]:
            continue
        if year and p.get("year") != year:
            continue
        if query:
            q = query.lower()
            haystack = f"{p.get('title','')} {p.get('authors','')} {p.get('abstract','')}".lower()
            if q not in haystack:
                continue
        results.append(p)

    return [PaperMeta(**p) for p in results[:limit]]


# ── Search papers (global) ───────────────────────────────
@router.get("/papers", response_model=list[PaperMeta])
async def search_papers(query: str = "", project: str = "", pinned: bool = False, limit: int = 50):
    papers = _load_all_papers()
    results = []

    for p in papers:
        pdir = _papers_dir() / p["paper_id"]
        tag_data = read_yaml(pdir / "tags.yaml") if pdir.exists() else {}
        p["tags"] = tag_data.get("tags", p.get("tags", []))
        p["projects"] = tag_data.get("projects", p.get("projects", []))
        p["pinned"] = tag_data.get("pinned", p.get("pinned", False))

        if pinned and not p["pinned"]:
            continue
        if project and project not in p["projects"]:
            continue
        if query:
            q = query.lower()
            haystack = f"{p.get('title','')} {p.get('authors','')} {p.get('abstract','')} {p.get('journal','')}".lower()
            if q not in haystack:
                continue
        results.append(p)

    return [PaperMeta(**p) for p in results[:limit]]


# ── Paper detail ─────────────────────────────────────────
@router.get("/papers/{paper_id}", response_model=PaperMeta)
async def get_paper(paper_id: str):
    papers = _load_all_papers()
    for p in papers:
        if p["paper_id"] == paper_id:
            ppdir = _papers_dir() / paper_id
            tag_data = read_yaml(ppdir / "tags.yaml") if ppdir.exists() else {}
            p["tags"] = tag_data.get("tags", p.get("tags", []))
            p["projects"] = tag_data.get("projects", p.get("projects", []))
            p["pinned"] = tag_data.get("pinned", p.get("pinned", False))
            return PaperMeta(**p)
    raise HTTPException(404, f"Paper {paper_id} not found")


# ── Paper notes ──────────────────────────────────────────
@router.get("/papers/{paper_id}/notes", response_model=PaperNotes)
async def get_paper_notes(paper_id: str):
    pdir = _papers_dir() / paper_id
    if not pdir.exists():
        raise HTTPException(404, f"Paper {paper_id} not found")
    content = read_markdown(pdir / "notes.md")
    return PaperNotes(content=content)


@router.put("/papers/{paper_id}/notes")
async def put_paper_notes(paper_id: str, body: PaperNotes):
    pdir = _papers_dir() / paper_id
    if not pdir.exists():
        raise HTTPException(404, f"Paper {paper_id} not found")
    write_markdown(pdir / "notes.md", body.content)
    return {"status": "ok"}


# ── Paper tags / project linking / pinning ───────────────
@router.put("/papers/{paper_id}/tags")
async def put_paper_tags(paper_id: str, body: dict):
    pdir = _papers_dir() / paper_id
    if not pdir.exists():
        raise HTTPException(404, f"Paper {paper_id} not found")
    tag_data = read_yaml(pdir / "tags.yaml")
    if "tags" in body:
        tag_data["tags"] = body["tags"]
    if "projects" in body:
        tag_data["projects"] = body["projects"]
    if "pinned" in body:
        tag_data["pinned"] = body["pinned"]
    write_yaml(pdir / "tags.yaml", tag_data)
    return {"status": "ok"}


@router.post("/papers/{paper_id}/pin")
async def toggle_pin(paper_id: str):
    pdir = _papers_dir() / paper_id
    if not pdir.exists():
        raise HTTPException(404, f"Paper {paper_id} not found")
    tag_data = read_yaml(pdir / "tags.yaml")
    tag_data["pinned"] = not tag_data.get("pinned", False)
    write_yaml(pdir / "tags.yaml", tag_data)
    return {"pinned": tag_data["pinned"]}
