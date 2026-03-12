"""Build canonical overview.json directly from template data.

This bypasses the lossy md → json round-trip by constructing the structured
overview JSON directly from the template's typed fields.
"""

from typing import Any


def build_overview_from_template(template: dict) -> dict[str, Any]:
    """Convert a template dict into canonical overview.json structure."""
    title = template.get("name", template.get("name_en", "Untitled"))
    overview_raw = template.get("overview", {})
    sections: list[dict] = []

    # 1. Definition
    defn = overview_raw.get("definition", "")
    if defn:
        text = defn.strip() if isinstance(defn, str) else str(defn)
        # Strip leading markdown heading if present
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("#"):
                continue
            if line:
                text = line
                break
        sections.append({
            "heading": "Definition",
            "type": "definition",
            "content": text,
        })

    # 2. Motivation
    motiv = overview_raw.get("motivation", "")
    if motiv:
        ctx, imp = _parse_motivation(motiv)
        sections.append({
            "heading": "Motivation",
            "type": "motivation",
            "context": ctx,
            "impact": imp,
        })

    # 3. Scope
    scope = overview_raw.get("scope", "")
    if scope:
        in_s, out_s = _parse_scope(scope)
        sections.append({
            "heading": "Scope",
            "type": "scope",
            "in_scope": in_s,
            "out_scope": out_s,
        })

    # 4. Questions
    questions = overview_raw.get("questions", [])
    if questions:
        items = []
        for i, q in enumerate(questions):
            if isinstance(q, dict):
                items.append({"id": q.get("id", f"Q{i+1}"), "text": q.get("text", str(q))})
            else:
                items.append({"id": f"Q{i+1}", "text": str(q)})
        sections.append({
            "heading": "Key Questions",
            "type": "questions",
            "items": items,
        })

    # 5. Concepts
    concepts = overview_raw.get("concepts", [])
    if concepts:
        items = []
        for c in concepts:
            if isinstance(c, dict):
                items.append({"term": c.get("term", ""), "description": c.get("description", "")})
            else:
                items.append({"term": str(c), "description": ""})
        sections.append({
            "heading": "Key Concepts",
            "type": "concepts",
            "items": items,
        })

    # 6. Pipeline
    pipeline = overview_raw.get("pipeline", [])
    if pipeline:
        steps = []
        for i, p in enumerate(pipeline):
            if isinstance(p, dict):
                steps.append({
                    "step": p.get("step_num", i + 1) if isinstance(p.get("step_num"), int) else i + 1,
                    "label": p.get("step", p.get("label", f"Step {i+1}")),
                    "description": p.get("description", ""),
                })
            else:
                steps.append({"step": i + 1, "label": str(p), "description": ""})
        sections.append({
            "heading": "Proposed System / Pipeline",
            "type": "pipeline",
            "steps": steps,
        })

    # 7. Evaluation
    evaluation = overview_raw.get("evaluation", [])
    if evaluation:
        items = []
        for e in evaluation:
            if isinstance(e, dict):
                items.append({"label": e.get("label", ""), "value": e.get("value", "")})
            else:
                items.append({"label": str(e), "value": ""})
        sections.append({
            "heading": "Evaluation / Success Criteria",
            "type": "evaluation",
            "items": items,
        })

    # 8. Deliverables
    deliverables = overview_raw.get("deliverables", [])
    if deliverables:
        items = []
        for d in deliverables:
            items.append(str(d) if not isinstance(d, dict) else d.get("text", d.get("title", str(d))))
        sections.append({
            "heading": "Deliverables",
            "type": "deliverables",
            "items": items,
        })

    # 9. Milestones
    milestones = overview_raw.get("milestones", [])
    if milestones:
        items = []
        for m in milestones:
            if isinstance(m, dict):
                items.append({
                    "id": m.get("id", ""),
                    "week": m.get("week", ""),
                    "title": m.get("title", ""),
                    "acceptance": m.get("acceptance", ""),
                    "status": m.get("status", "pending"),
                })
            else:
                items.append({"id": "", "week": "", "title": str(m), "acceptance": "", "status": "pending"})
        sections.append({
            "heading": "Milestones",
            "type": "milestones",
            "items": items,
        })

    # 10. Risks
    risks = overview_raw.get("risks", [])
    if risks:
        items = []
        for r in risks:
            if isinstance(r, dict):
                items.append({"risk": r.get("risk", ""), "mitigation": r.get("mitigation", "")})
            else:
                items.append({"risk": str(r), "mitigation": ""})
        sections.append({
            "heading": "Risks",
            "type": "risks",
            "items": items,
        })

    # 11. Literature entry points
    literature = overview_raw.get("literature", [])
    if literature:
        items = []
        for lit in literature:
            if isinstance(lit, dict):
                items.append({"label": lit.get("label", ""), "value": lit.get("value", "")})
            else:
                items.append({"label": str(lit), "value": ""})
        sections.append({
            "heading": "Literature Entry Points",
            "type": "literature",
            "items": items,
        })

    # 12. Next actions
    actions = overview_raw.get("next_actions", [])
    if actions:
        items = []
        for a in actions:
            if isinstance(a, dict):
                items.append({"text": a.get("text", ""), "done": a.get("done", False)})
            else:
                items.append({"text": str(a), "done": False})
        sections.append({
            "heading": "Next Actions",
            "type": "actions",
            "items": items,
        })

    return {"title": title, "sections": sections}


def _parse_motivation(raw) -> tuple[list[str], list[str]]:
    """Parse motivation content into context and impact lists."""
    if isinstance(raw, dict):
        return raw.get("context", []), raw.get("impact", [])
    if not isinstance(raw, str):
        return [], []

    text = raw.strip()
    # Try to split by labeled groups
    context = []
    impact = []
    current_group = "context"

    for line in text.split("\n"):
        stripped = line.strip()
        lower = stripped.lower()
        if lower.startswith("**impact") or lower.startswith("impact"):
            current_group = "impact"
            continue
        if lower.startswith("**context") or lower.startswith("context") or lower.startswith("#"):
            current_group = "context"
            continue
        if stripped.startswith("- "):
            item = stripped[2:].strip()
            if current_group == "impact":
                impact.append(item)
            else:
                context.append(item)

    return context, impact


def _parse_scope(raw) -> tuple[list[str], list[str]]:
    """Parse scope content into in_scope and out_scope lists."""
    if isinstance(raw, dict):
        return raw.get("in_scope", []), raw.get("out_scope", [])
    if not isinstance(raw, str):
        return [], []

    text = raw.strip()
    in_scope = []
    out_scope = []
    current_group = "in"

    for line in text.split("\n"):
        stripped = line.strip()
        lower = stripped.lower()
        if "out of scope" in lower or "out_scope" in lower:
            current_group = "out"
            continue
        if "in scope" in lower or "in_scope" in lower:
            current_group = "in"
            continue
        if lower.startswith("#"):
            continue
        if stripped.startswith("- "):
            item = stripped[2:].strip()
            if current_group == "out":
                out_scope.append(item)
            else:
                in_scope.append(item)

    return in_scope, out_scope
