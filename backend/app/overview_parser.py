"""Parse overview.md into structured overview.json sections."""

import re
from typing import Any


def parse_overview_md(md: str) -> dict[str, Any]:
    """Parse a structured overview.md into a JSON-friendly dict."""
    if not md.strip():
        return {}

    sections: list[dict] = []
    current_h2: dict | None = None
    buffer: list[str] = []
    title = ""

    for line in md.split("\n"):
        # Project title (H1)
        if line.startswith("# ") and not title:
            title = line[2:].strip()
            continue

        # H2 section header — accepts both "## 1. Title" and "## Title"
        m = re.match(r"^## (?:\d+\.\s*)?(.+)$", line)
        if m:
            if current_h2:
                current_h2["raw"] = "\n".join(buffer).strip()
                _parse_section_content(current_h2)
                sections.append(current_h2)
            current_h2 = {"heading": m.group(1).strip(), "raw": ""}
            buffer = []
            continue

        buffer.append(line)

    # Flush last section
    if current_h2:
        current_h2["raw"] = "\n".join(buffer).strip()
        _parse_section_content(current_h2)
        sections.append(current_h2)

    return {
        "title": title,
        "sections": sections,
    }


def _parse_section_content(section: dict) -> None:
    """Parse raw content into structured fields based on heading type."""
    heading = section["heading"].lower()
    raw = section["raw"]

    if "definition" in heading:
        section["type"] = "definition"
        section["content"] = _extract_bold_value(raw, "Definition") if "**Definition" in raw else raw.strip()

    elif "motivation" in heading or "why it matters" in heading:
        section["type"] = "motivation"
        ctx = _extract_bullet_group(raw, "Context")
        imp = _extract_bullet_group(raw, "Impact")
        # Fallback: if no labeled groups, treat all bullets as context
        if not ctx and not imp:
            ctx = [line.strip()[2:] for line in raw.split("\n") if line.strip().startswith("- ")]
        section["context"] = ctx
        section["impact"] = imp

    elif "scope" in heading:
        section["type"] = "scope"
        section["in_scope"] = _extract_bullet_group(raw, "In scope") or _extract_bullet_group(raw, "In Scope")
        section["out_scope"] = _extract_bullet_group(raw, "Out of scope") or _extract_bullet_group(raw, "Out of Scope")
        # Fallback: all bullets as in_scope
        if not section["in_scope"] and not section["out_scope"]:
            section["in_scope"] = [line.strip()[2:] for line in raw.split("\n") if line.strip().startswith("- ")]

    elif "question" in heading:
        section["type"] = "questions"
        section["items"] = _extract_questions(raw)
        # Fallback: plain bullets as questions
        if not section["items"]:
            section["items"] = [{"id": f"Q{i+1}", "text": line.strip()[2:]}
                                for i, line in enumerate(raw.split("\n"))
                                if line.strip().startswith("- ")]

    elif "concept" in heading or "taxonomy" in heading:
        section["type"] = "concepts"
        section["items"] = _extract_concept_defs(raw)
        # Fallback: plain bullets
        if not section["items"]:
            section["items"] = [{"term": line.strip()[2:].split(":")[0].strip("* "),
                                  "description": ":".join(line.strip()[2:].split(":")[1:]).strip() if ":" in line else ""}
                                for line in raw.split("\n") if line.strip().startswith("- ")]

    elif "proposed system" in heading or "pipeline" in heading:
        section["type"] = "pipeline"
        section["steps"] = _extract_numbered_steps(raw)
        # Fallback: numbered list items "1. **Label:** desc" or "1. text"
        if not section["steps"]:
            for i, line in enumerate(raw.split("\n")):
                m2 = re.match(r"^\d+[\.\)]\s*\*\*(.+?):\*\*\s*(.+)$", line.strip())
                if m2:
                    section["steps"].append({"step": i+1, "label": m2.group(1), "description": m2.group(2).strip()})
                else:
                    m3 = re.match(r"^\d+[\.\)]\s*(.+)$", line.strip())
                    if m3:
                        section["steps"].append({"step": i+1, "label": m3.group(1)[:40], "description": m3.group(1).strip()})

    elif "evaluation" in heading or "success criteria" in heading:
        section["type"] = "evaluation"
        section["items"] = _extract_labeled_bullets(raw)
        # Fallback: plain bullets
        if not section["items"]:
            section["items"] = [{"label": line.strip()[2:].split(":")[0].strip("* "),
                                  "value": ":".join(line.strip()[2:].split(":")[1:]).strip() if ":" in line else line.strip()[2:]}
                                for line in raw.split("\n") if line.strip().startswith("- ")]

    elif "deliverables" in heading:
        section["type"] = "deliverables"
        section["items"] = _extract_deliverables(raw)

    elif "milestone" in heading:
        section["type"] = "milestones"
        section["items"] = _extract_milestones(raw)
        # Fallback: parse "- **M1**: title" or "- M1 (Week 1-2): title — Acceptance: criteria"
        if not section["items"]:
            for line in raw.split("\n"):
                m2 = re.match(r"^- \*\*(.+?)(?::\*\*|\*\*:)\s*(.+?)(?:\s*—\s*Acceptance:\s*(.+))?$", line.strip())
                if m2:
                    section["items"].append({
                        "id": m2.group(1).strip(),
                        "title": m2.group(2).strip(),
                        "acceptance": (m2.group(3) or "").strip(),
                        "week": "",
                        "status": "pending",
                    })
                # Also handle "- Milestone text" plain bullets
                elif line.strip().startswith("- ") and not m2:
                    text = line.strip()[2:]
                    if text and not any(text.startswith(prefix) for prefix in ["**"]):
                        section["items"].append({"id": "", "title": text, "week": "", "acceptance": "", "status": "pending"})

    elif "risk" in heading:
        section["type"] = "risks"
        section["items"] = _extract_risks(raw)
        # Fallback: "- **Risk:** desc → Mitigation: mitigation" or plain bullets
        if not section["items"]:
            for line in raw.split("\n"):
                m2 = re.match(r"^- \*\*(.+?)(?::\*\*|\*\*)\s*(.*)$", line.strip())
                if m2:
                    parts = m2.group(2).split("→")
                    section["items"].append({
                        "risk": m2.group(1).strip(),
                        "mitigation": parts[1].replace("Mitigation:", "").strip() if len(parts) > 1 else "",
                    })
                elif line.strip().startswith("- "):
                    text = line.strip()[2:]
                    if "→" in text:
                        parts = text.split("→")
                        section["items"].append({"risk": parts[0].strip(), "mitigation": parts[1].strip()})
                    else:
                        section["items"].append({"risk": text, "mitigation": ""})

    elif "literature" in heading:
        section["type"] = "literature"
        section["items"] = _extract_labeled_bullets(raw)

    elif "next actions" in heading:
        section["type"] = "actions"
        section["items"] = _extract_actions(raw)

    else:
        section["type"] = "text"
        section["content"] = raw


def _extract_bold_value(raw: str, label: str) -> str:
    """Extract '- **Label:** value' pattern."""
    m = re.search(rf"\*\*{label}:\*\*\s*(.+)", raw)
    return m.group(1).strip() if m else raw.strip().lstrip("- ").strip()


def _extract_bullet_group(raw: str, label: str) -> list[str]:
    """Extract bullets under a **Label:** header."""
    pattern = rf"\*\*{label}:\*\*"
    m = re.search(pattern, raw)
    if not m:
        return []

    start = m.end()
    rest = raw[start:]
    bullets = []
    for line in rest.split("\n"):
        line = line.strip()
        if line.startswith("- **") and ":" in line and label not in line:
            break  # next group
        if line.startswith("- "):
            bullets.append(line[2:].strip())
        elif line.startswith("  - "):
            bullets.append(line[4:].strip())
    return bullets


def _extract_questions(raw: str) -> list[dict]:
    """Extract Q1:, Q2: style questions."""
    items = []
    for line in raw.split("\n"):
        m = re.match(r"^- (Q\d+):\s*(.+)$", line.strip())
        if m:
            items.append({"id": m.group(1), "text": m.group(2).strip()})
    return items


def _extract_concept_defs(raw: str) -> list[dict]:
    """Extract '- **Term:** description' concept definitions."""
    items = []
    current = None
    for line in raw.split("\n"):
        m = re.match(r"^- \*\*(.+?):\*\*\s*(.+)$", line.strip())
        if m:
            if current:
                items.append(current)
            current = {"term": m.group(1), "description": m.group(2).strip()}
        elif current and line.strip():
            current["description"] += " " + line.strip()
    if current:
        items.append(current)
    return items


def _extract_numbered_steps(raw: str) -> list[dict]:
    """Extract numbered pipeline steps."""
    items = []
    current = None
    for line in raw.split("\n"):
        m = re.match(r"^(\d+)\)\s*\*\*(.+?):\*\*\s*(.+)$", line.strip())
        if m:
            if current:
                items.append(current)
            current = {"step": int(m.group(1)), "label": m.group(2), "description": m.group(3).strip()}
        elif current and line.strip():
            current["description"] += " " + line.strip()
    if current:
        items.append(current)
    return items


def _extract_labeled_bullets(raw: str) -> list[dict]:
    """Extract '- **Label:** value' entries."""
    items = []
    for line in raw.split("\n"):
        m = re.match(r"^- \*\*(.+?):\*\*\s*(.+)$", line.strip())
        if m:
            items.append({"label": m.group(1), "value": m.group(2).strip()})
    return items


def _extract_deliverables(raw: str) -> list[str]:
    """Extract deliverable items."""
    items = []
    for line in raw.split("\n"):
        m = re.match(r"^- (D\d+):\s*(.+)$", line.strip())
        if m:
            items.append(f"{m.group(1)}: {m.group(2).strip()}")
        elif line.strip().startswith("- "):
            items.append(line.strip()[2:])
    return items


def _extract_milestones(raw: str) -> list[dict]:
    """Extract milestone entries like 'M1 (Week 2): title — Acceptance: criteria'."""
    items = []
    for line in raw.split("\n"):
        m = re.match(
            r"^- (M\d+)\s*\(([^)]+)\):\s*(.+?)(?:\s*—\s*Acceptance:\s*(.+))?$",
            line.strip()
        )
        if m:
            items.append({
                "id": m.group(1),
                "week": m.group(2).strip(),
                "title": m.group(3).strip(),
                "acceptance": (m.group(4) or "").strip(),
                "status": "pending",
            })
    return items


def _extract_risks(raw: str) -> list[dict]:
    """Extract risk entries."""
    items = []
    for line in raw.split("\n"):
        m = re.match(r"^- Risk \d+:\s*(.+?)(?:\s*—\s*Mitigation:\s*(.+))?$", line.strip())
        if m:
            items.append({
                "risk": m.group(1).strip(),
                "mitigation": (m.group(2) or "").strip(),
            })
    return items


def _extract_actions(raw: str) -> list[dict]:
    """Extract action items (checkboxes)."""
    items = []
    for line in raw.split("\n"):
        m = re.match(r"^- \[([ xX])\]\s*(.+)$", line.strip())
        if m:
            items.append({
                "text": m.group(2).strip(),
                "done": m.group(1).lower() == "x",
            })
    return items
