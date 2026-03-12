"""Global event stream — append-only JSONL at reports/events/events.jsonl."""

from datetime import datetime
from pathlib import Path
from .config import settings
from .utils import append_jsonl


def _events_path() -> Path:
    p = settings.reports_dir / "events"
    p.mkdir(parents=True, exist_ok=True)
    return p / "events.jsonl"


def emit_event(
    project_id: str,
    kind: str,
    action: str,
    summary: str,
    ref: dict | None = None,
) -> dict:
    """Append an event to the global event stream and return the event dict.

    kind:   log | step | literature | artifact | timeline | report
    action: create | update | delete | status_change | import | generate
    """
    event = {
        "ts": datetime.utcnow().isoformat(),
        "project_id": project_id,
        "kind": kind,
        "action": action,
        "summary": summary,
        "ref": ref or {},
    }
    append_jsonl(_events_path(), event)
    return event


def read_events(limit: int = 200, since: str | None = None) -> list[dict]:
    """Read recent events, optionally filtered by timestamp."""
    from .utils import read_jsonl
    events = read_jsonl(_events_path(), limit=limit)
    if since:
        events = [e for e in events if e.get("ts", "") >= since]
    return events


def read_events_for_date(date_str: str) -> list[dict]:
    """Read events for a specific date (YYYY-MM-DD)."""
    from .utils import read_jsonl
    events = read_jsonl(_events_path(), limit=10000)
    return [e for e in events if e.get("ts", "").startswith(date_str)]


def read_events_for_week(year: int, week: int) -> list[dict]:
    """Read events for an ISO week."""
    from .utils import read_jsonl
    from datetime import date, timedelta
    # Compute start/end of ISO week
    jan4 = date(year, 1, 4)
    start = jan4 + timedelta(weeks=week - 1, days=-jan4.weekday())
    end = start + timedelta(days=7)
    start_str = start.isoformat()
    end_str = end.isoformat()
    events = read_jsonl(_events_path(), limit=10000)
    return [e for e in events if start_str <= e.get("ts", "")[:10] < end_str]
