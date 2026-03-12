"""Generate VC/VR execution steps from structured overview milestones and concepts."""

from typing import Any
import uuid


def generate_execution_steps(overview: dict[str, Any]) -> dict[str, list[dict]]:
    """Generate vc_steps and vr_steps from overview milestones and pipeline."""
    sections = {s["type"]: s for s in overview.get("sections", [])}

    milestones = sections.get("milestones", {}).get("items", [])
    pipeline = sections.get("pipeline", {}).get("steps", [])
    concepts = sections.get("concepts", {}).get("items", [])
    actions = sections.get("actions", {}).get("items", [])

    vc_steps = []
    vr_steps = []

    # ── VC Steps: derived from pipeline steps + actions ──
    # Phase 1: Setup & Infrastructure
    vc_steps.append(_step(
        "Environment setup & repo scaffolding",
        "Set up dev environment, dependencies, CI/CD, project structure",
        "Repo builds and tests pass; README with setup instructions",
        "setup", "M0",
    ))

    # From pipeline steps → implementation tasks
    for ps in pipeline:
        label = ps.get("label", "")
        desc = ps.get("description", "")
        vc_steps.append(_step(
            f"Implement: {label}",
            f"Build the {label} component — {desc[:120]}",
            f"{label} module passes unit tests and produces expected output",
            "implementation", ps.get("step", ""),
        ))

    # From concepts → component implementations
    for c in concepts:
        if isinstance(c, dict):
            term = c.get("term", "")
            desc = c.get("description", "")[:100]
        else:
            term = str(c)
            desc = term
        vc_steps.append(_step(
            f"Build {term} module",
            f"Implement {term}: {desc}",
            f"{term} component functional with test coverage",
            "implementation", "",
        ))

    # Integration & testing
    vc_steps.append(_step(
        "Integration testing",
        "End-to-end pipeline test with sample data",
        "Full pipeline runs without errors on test dataset",
        "testing", "",
    ))

    vc_steps.append(_step(
        "Demo & visualization",
        "Build demo interface or visualization for results",
        "Demo runnable and shows key results",
        "demo", "",
    ))

    # From actions → immediate tasks (mark first as doing)
    for a in actions:
        if isinstance(a, dict):
            text = a.get("text", "")
            status = "done" if a.get("done") else "todo"
        else:
            text = str(a)
            status = "todo"
        vc_steps.append(_step(
            text,
            f"Immediate action: {text}",
            "Task completed and verified",
            "action", "",
            status=status,
        ))

    # ── VR Steps: derived from milestones + evaluation ──
    # Literature review
    vr_steps.append(_step(
        "Literature survey & gap analysis",
        "Review related work, identify gaps, position contribution",
        "Literature matrix with 20+ papers categorized; gap statement written",
        "literature", "M0",
    ))

    # From milestones → research milestones
    for m in milestones:
        if isinstance(m, dict):
            mid = m.get("id", "")
            title = m.get("title", "")
            acceptance = m.get("acceptance", "")
            week = m.get("week", "")
        else:
            mid = ""
            title = str(m)
            acceptance = ""
            week = ""
        vr_steps.append(_step(
            f"{mid}: {title}" if mid else title,
            f"Research milestone ({week}) — {title}" if week else f"Research milestone — {title}",
            acceptance or f"{title} completed and documented",
            "milestone", mid,
        ))

    # Evaluation & analysis
    eval_section = sections.get("evaluation", {})
    eval_items = eval_section.get("items", [])
    if eval_items:
        vr_steps.append(_step(
            "Run primary evaluation",
            "Execute all primary and secondary metric evaluations",
            "Evaluation results table with all metrics computed",
            "evaluation", "",
        ))
        vr_steps.append(_step(
            "Ablation studies",
            "Run ablation experiments to validate component contributions",
            "Ablation results table with statistical significance",
            "evaluation", "",
        ))

    # Paper writing
    vr_steps.append(_step(
        "Draft paper",
        "Write first complete draft following paper plan outline",
        "Complete draft with all sections, figures, and tables",
        "writing", "",
    ))

    vr_steps.append(_step(
        "Internal review & revision",
        "Get feedback and revise manuscript",
        "Revised draft addressing all review comments",
        "writing", "",
    ))

    # Mark first non-done step as "doing" in each list
    _activate_first(vc_steps)
    _activate_first(vr_steps)

    return {"vc_steps": vc_steps, "vr_steps": vr_steps}


def _step(title: str, description: str, acceptance: str, section: str,
          linked_milestone: str, status: str = "todo") -> dict:
    return {
        "id": str(uuid.uuid4())[:8],
        "title": title,
        "description": description,
        "acceptance": acceptance,
        "section": section,
        "linked_milestone": str(linked_milestone),
        "status": status,
    }


def _activate_first(steps: list[dict]) -> None:
    """Mark the first 'todo' step as 'doing'."""
    for s in steps:
        if s["status"] == "todo":
            s["status"] = "doing"
            return
