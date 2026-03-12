"""Strict JSON schema validation for VibeScholar project templates."""

from typing import Any

REQUIRED_TOP_KEYS = {"id", "name", "overview"}
OVERVIEW_SECTIONS = {
    "definition", "motivation", "scope", "questions", "concepts",
    "pipeline", "evaluation", "deliverables", "milestones", "risks",
    "literature", "next_actions",
}


class TemplateValidationError(Exception):
    """Raised when template validation fails."""
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__(f"Template validation failed: {'; '.join(errors)}")


def validate_template(data: Any) -> list[str]:
    """Validate a parsed template dict. Returns list of error strings (empty = valid)."""
    errors: list[str] = []

    if not isinstance(data, dict):
        return ["Template must be a JSON object"]

    # Required top-level keys
    for key in REQUIRED_TOP_KEYS:
        if key not in data or not data[key]:
            errors.append(f"Missing or empty required field: '{key}'")

    # id must be a slug
    tid = data.get("id", "")
    if tid and not isinstance(tid, str):
        errors.append("'id' must be a string")
    elif tid and not all(c.isalnum() or c in "-_" for c in tid):
        errors.append("'id' must be a slug (lowercase alphanumeric, hyphens, underscores)")

    # overview must be a dict
    overview = data.get("overview")
    if overview is not None and not isinstance(overview, dict):
        errors.append("'overview' must be an object")
    elif isinstance(overview, dict):
        # Validate milestone items if present
        milestones = overview.get("milestones", [])
        if isinstance(milestones, list):
            for i, m in enumerate(milestones):
                if isinstance(m, dict):
                    if not m.get("id"):
                        errors.append(f"overview.milestones[{i}] missing 'id'")
                    if not m.get("title"):
                        errors.append(f"overview.milestones[{i}] missing 'title'")

        # Validate concepts
        concepts = overview.get("concepts", [])
        if isinstance(concepts, list):
            for i, c in enumerate(concepts):
                if isinstance(c, dict) and not c.get("term"):
                    errors.append(f"overview.concepts[{i}] missing 'term'")

        # Validate pipeline steps
        pipeline = overview.get("pipeline", [])
        if isinstance(pipeline, list):
            for i, p in enumerate(pipeline):
                if isinstance(p, dict) and not p.get("step"):
                    errors.append(f"overview.pipeline[{i}] missing 'step'")

    # Validate execution if provided
    execution = data.get("execution")
    if execution is not None:
        if not isinstance(execution, dict):
            errors.append("'execution' must be an object with 'vc_steps' and/or 'vr_steps'")
        else:
            for key in ("vc_steps", "vr_steps"):
                steps = execution.get(key, [])
                if not isinstance(steps, list):
                    errors.append(f"execution.{key} must be an array")
                else:
                    for i, s in enumerate(steps):
                        if isinstance(s, dict) and not s.get("title"):
                            errors.append(f"execution.{key}[{i}] missing 'title'")

    # Validate artifacts if provided
    artifacts = data.get("artifacts")
    if artifacts is not None:
        if not isinstance(artifacts, list):
            errors.append("'artifacts' must be an array")
        else:
            for i, a in enumerate(artifacts):
                if isinstance(a, dict):
                    if not a.get("name"):
                        errors.append(f"artifacts[{i}] missing 'name'")
                    if not a.get("type"):
                        errors.append(f"artifacts[{i}] missing 'type'")

    return errors


def clean_template(data: dict) -> dict:
    """Strip prompt instructions and internal keys from template before processing."""
    cleaned = {k: v for k, v in data.items() if not k.startswith("_")}
    return cleaned
