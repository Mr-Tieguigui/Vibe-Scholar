"""Generate detailed experiment and paper plans from structured overview data."""

from typing import Any


def generate_experiment_plan(overview: dict[str, Any]) -> str:
    """Generate a detailed experiment plan from structured overview JSON."""
    title = overview.get("title", "Untitled Project")
    sections = {s["type"]: s for s in overview.get("sections", [])}

    lines = [f"# Experiment Plan: {title}\n"]

    # 1. Hypotheses from questions
    questions = sections.get("questions", {})
    q_items = questions.get("items", [])
    lines.append("## 1. Research Hypotheses\n")
    if q_items:
        for i, q in enumerate(q_items, 1):
            qtext = q.get("text", "")
            lines.append(f"**H{i}:** We hypothesize that {_hypothesis_from_question(qtext)}\n")
            lines.append(f"- *Derived from:* {q.get('id', f'Q{i}')}: {qtext}")
            lines.append(f"- *Falsifiable by:* {_falsification_hint(qtext)}\n")
    else:
        lines.append("*Define hypotheses based on project questions.*\n")

    # 2. Baselines & Comparisons
    lines.append("## 2. Baselines & Comparisons\n")
    eval_section = sections.get("evaluation", {})
    eval_items = eval_section.get("items", [])
    baselines = [e for e in eval_items if "baseline" in e.get("label", "").lower()]
    if baselines:
        for b in baselines:
            lines.append(f"- **{b['label']}:** {b['value']}")
    else:
        lines.append("| Baseline | Description | Expected Gap |")
        lines.append("|----------|-------------|--------------|")
        lines.append("| No-intervention | Raw model without proposed method | Reference |")
        lines.append("| Ablation-core | Remove core component | Measure contribution |")
        lines.append("| Prior-art | Best published result | Target to beat |")
    lines.append("")

    # 3. Datasets
    lines.append("## 3. Datasets & Data Sources\n")
    pipeline = sections.get("pipeline", {})
    steps = pipeline.get("steps", [])
    if steps and len(steps) > 0:
        input_step = steps[0]
        lines.append(f"**Primary source:** {input_step.get('description', 'TBD')}\n")
    lines.append("| Dataset | Domain | Size (est.) | Purpose |")
    lines.append("|---------|--------|-------------|---------|")
    scope = sections.get("scope", {})
    in_scope = scope.get("in_scope", [])
    for i, s in enumerate(in_scope[:4], 1):
        lines.append(f"| D{i} | {s[:40]} | TBD | Evaluation |")
    lines.append("")

    # 4. Metrics
    lines.append("## 4. Evaluation Metrics\n")
    lines.append("### Primary Metrics\n")
    primary = [e for e in eval_items if "primary" in e.get("label", "").lower()]
    if primary:
        for p in primary:
            lines.append(f"- **{p['label']}:** {p['value']}")
    lines.append("\n### Secondary Metrics\n")
    secondary = [e for e in eval_items if "secondary" in e.get("label", "").lower()]
    if secondary:
        for s in secondary:
            lines.append(f"- **{s['label']}:** {s['value']}")
    lines.append("")

    # 5. Ablation Study Design
    lines.append("## 5. Ablation Study Design\n")
    ablations = [e for e in eval_items if "ablat" in e.get("label", "").lower()]
    if ablations:
        for a in ablations:
            lines.append(f"- {a['value']}")
    else:
        concepts = sections.get("concepts", {}).get("items", [])
        lines.append("| Component Removed | Expected Effect | Measures |")
        lines.append("|-------------------|-----------------|----------|")
        for c in concepts[:4]:
            term = c.get('term', '?') if isinstance(c, dict) else str(c)
            lines.append(f"| Remove {term} | Degraded performance | Primary metrics |")
    lines.append("")

    # 6. Threats to Validity
    lines.append("## 6. Threats to Validity\n")
    threats = [e for e in eval_items if "threat" in e.get("label", "").lower()]
    if threats:
        for t in threats:
            lines.append(f"- {t['value']}")
    risks = sections.get("risks", {}).get("items", [])
    if risks:
        for r in risks:
            if isinstance(r, dict):
                lines.append(f"- **{r.get('risk', '')}** → Mitigation: {r.get('mitigation', '')}")
            else:
                lines.append(f"- {r}")
    lines.append("")

    # 7. Milestones with detailed acceptance
    lines.append("## 7. Experiment Milestones\n")
    milestones = sections.get("milestones", {}).get("items", [])
    if milestones:
        lines.append("| ID | Timeline | Task | Acceptance Criteria | Dependencies |")
        lines.append("|----|----------|------|---------------------|--------------|")
        for i, m in enumerate(milestones):
            if isinstance(m, dict):
                deps = milestones[i - 1].get("id", "—") if i > 0 and isinstance(milestones[i-1], dict) else "—"
                lines.append(f"| {m.get('id', '')} | {m.get('week', '')} | {m.get('title', '')} | {m.get('acceptance', '')} | {deps} |")
            else:
                lines.append(f"| {i+1} | — | {m} | — | — |")
    lines.append("")

    # 8. Compute & Resource Requirements
    lines.append("## 8. Compute & Resource Requirements\n")
    lines.append("| Resource | Estimate | Notes |")
    lines.append("|----------|----------|-------|")
    lines.append("| GPU hours | TBD | Based on model size and dataset |")
    lines.append("| Storage | TBD | Raw data + processed + checkpoints |")
    lines.append("| External APIs | TBD | If applicable |")
    lines.append("| Human annotation | TBD | Pilot validation hours |")
    lines.append("")

    # 9. Experimental Protocol
    lines.append("## 9. Experimental Protocol\n")
    if steps:
        for s in steps:
            lines.append(f"### Step {s.get('step', '?')}: {s.get('label', '')}\n")
            lines.append(f"{s.get('description', '')}\n")
            lines.append("- **Input:** TBD")
            lines.append("- **Output:** TBD")
            lines.append("- **Validation:** TBD\n")

    return "\n".join(lines) + "\n"


def generate_paper_plan(overview: dict[str, Any]) -> str:
    """Generate a detailed paper plan from structured overview JSON."""
    title = overview.get("title", "Untitled Project")
    sections = {s["type"]: s for s in overview.get("sections", [])}

    lines = [f"# Paper Plan: {title}\n"]

    # 1. Target Venue
    lines.append("## 1. Target Venue\n")
    lines.append("| Field | Value |")
    lines.append("|-------|-------|")
    lines.append("| Primary venue | TBD (NeurIPS / ICML / ACL / USENIX / S&P) |")
    lines.append("| Submission deadline | TBD |")
    lines.append("| Page limit | 8–10 + appendix |")
    lines.append("| Paper type | Research / Benchmark / Systems / Position |")
    lines.append("")

    # 2. Contribution Statement
    lines.append("## 2. Key Contributions\n")
    defn = sections.get("definition", {})
    lines.append(f"**Core claim:** {defn.get('content', 'TBD')}\n")
    deliverables = sections.get("deliverables", {}).get("items", [])
    if deliverables:
        lines.append("**Concrete contributions:**\n")
        for i, d in enumerate(deliverables, 1):
            lines.append(f"{i}. {d if isinstance(d, str) else d.get('text', str(d))}")
    lines.append("")

    # 3. Paper Outline
    lines.append("## 3. Paper Outline\n")
    lines.append("### §1 Introduction (1.5 pages)\n")
    motivation = sections.get("motivation", {})
    context = motivation.get("context", [])
    if context:
        lines.append("**Opening context:**")
        for c in context[:3]:
            lines.append(f"- {c}")
    impact = motivation.get("impact", [])
    if impact:
        lines.append("\n**Our contribution addresses:**")
        for imp in impact:
            lines.append(f"- {imp}")
    lines.append("")

    lines.append("### §2 Related Work (1.5 pages)\n")
    lit = sections.get("literature", {}).get("items", [])
    if lit:
        for l in lit:
            lines.append(f"- **{l.get('label', '')}:** {l.get('value', '')}")
    lines.append("")

    lines.append("### §3 Method / System Design (2–3 pages)\n")
    concepts = sections.get("concepts", {}).get("items", [])
    if concepts:
        for idx, c in enumerate(concepts):
            if isinstance(c, dict):
                lines.append(f"- **§3.{idx+1} {c.get('term', '')}:** {c.get('description', '')[:80]}...")
            else:
                lines.append(f"- **§3.{idx+1}** {c}")
    lines.append("")

    lines.append("### §4 Experimental Setup (1 page)\n")
    lines.append("- Datasets, baselines, metrics, hardware, hyperparameters")
    lines.append("- Reproducibility checklist\n")

    lines.append("### §5 Results & Analysis (2 pages)\n")
    eval_items = sections.get("evaluation", {}).get("items", [])
    if eval_items:
        lines.append("**Key results to report:**")
        for e in eval_items[:5]:
            lines.append(f"- {e.get('label', '')}: {e.get('value', '')}")
    lines.append("")

    lines.append("### §6 Ablation Studies (0.5–1 page)\n")
    lines.append("- Component ablations mapped from experiment plan\n")

    lines.append("### §7 Discussion & Limitations (0.5 page)\n")
    risks = sections.get("risks", {}).get("items", [])
    if risks:
        lines.append("**Known limitations:**")
        for r in risks:
            if isinstance(r, dict):
                lines.append(f"- {r.get('risk', '')}")
            else:
                lines.append(f"- {r}")
    lines.append("")

    lines.append("### §8 Conclusion (0.5 page)\n")
    lines.append("- Summarize contributions and future directions\n")

    # 4. Figures & Tables Plan
    lines.append("## 4. Figures & Tables\n")
    lines.append("| # | Type | Caption (draft) | Data Source |")
    lines.append("|---|------|-----------------|-------------|")
    lines.append("| Fig 1 | Diagram | System architecture / pipeline overview | §3 |")
    lines.append("| Fig 2 | Chart | Main results comparison | §5 |")
    lines.append("| Fig 3 | Chart | Ablation analysis | §6 |")
    lines.append("| Tab 1 | Table | Dataset statistics | §4 |")
    lines.append("| Tab 2 | Table | Main results table | §5 |")
    lines.append("| Tab 3 | Table | Ablation results | §6 |")
    lines.append("")

    # 5. Experiment → Section Mapping
    lines.append("## 5. Experiment → Section Mapping\n")
    milestones = sections.get("milestones", {}).get("items", [])
    if milestones:
        lines.append("| Experiment (Milestone) | Paper Section | Figure/Table |")
        lines.append("|------------------------|---------------|--------------|")
        for m in milestones[:6]:
            if isinstance(m, dict):
                lines.append(f"| {m.get('id','')}: {m.get('title','')} | §5 Results | TBD |")
            else:
                lines.append(f"| {m} | §5 Results | TBD |")
    lines.append("")

    # 6. Writing Schedule
    lines.append("## 6. Writing Schedule\n")
    lines.append("| Phase | Weeks | Deliverable |")
    lines.append("|-------|-------|-------------|")
    lines.append("| Draft §3 (Method) | W1–W2 | Method section + system diagram |")
    lines.append("| Draft §4–5 (Experiments) | W3–W4 | Setup + initial results |")
    lines.append("| Draft §1–2 (Intro + Related) | W5 | Framing + literature review |")
    lines.append("| Draft §6–8 (Ablation + Conclusion) | W6 | Complete first draft |")
    lines.append("| Internal review | W7 | Feedback round |")
    lines.append("| Camera-ready | W8 | Final version |")
    lines.append("")

    return "\n".join(lines) + "\n"


def _hypothesis_from_question(q: str) -> str:
    """Convert a question into a hypothesis statement."""
    q = q.rstrip("?").strip()
    q_lower = q.lower()
    if q_lower.startswith("how "):
        return f"our proposed approach provides a measurable answer to: {q}"
    if q_lower.startswith("what "):
        return f"we can systematically characterize: {q}"
    if q_lower.startswith("can "):
        return f"it is feasible to {q[4:]}"
    return f"investigating '{q}' yields actionable insights"


def _falsification_hint(q: str) -> str:
    """Suggest how a hypothesis could be falsified."""
    q_lower = q.lower()
    if "effective" in q_lower or "improve" in q_lower:
        return "No statistically significant improvement over baseline"
    if "distinguish" in q_lower or "detect" in q_lower:
        return "Detection/distinction accuracy not above random chance"
    if "how" in q_lower:
        return "Proposed method fails to produce measurable signal"
    return "Null result with p > 0.05 across all evaluation dimensions"
