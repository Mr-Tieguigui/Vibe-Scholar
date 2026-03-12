"""Atomic file-write and file-lock utilities."""

import os
import tempfile
import fcntl
from pathlib import Path
from contextlib import contextmanager
from typing import Union

import yaml
import orjson


def atomic_write(path: Path, content: Union[str, bytes], mode: str = "text") -> None:
    """Write content to path atomically via temp file + rename."""
    path.parent.mkdir(parents=True, exist_ok=True)
    suffix = path.suffix or ".tmp"
    fd, tmp_path = tempfile.mkstemp(dir=path.parent, suffix=suffix)
    try:
        if mode == "text":
            os.write(fd, content.encode("utf-8") if isinstance(content, str) else content)
        else:
            os.write(fd, content if isinstance(content, bytes) else content.encode("utf-8"))
        os.close(fd)
        os.replace(tmp_path, str(path))
    except Exception:
        os.close(fd) if not os.get_inheritable(fd) else None
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise


@contextmanager
def file_lock(path: Path):
    """Best-effort advisory file lock."""
    lock_path = path.parent / f".{path.name}.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock_fd = open(lock_path, "w")
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()


def read_yaml(path: Path) -> dict:
    """Read YAML file, return empty dict if missing or corrupt."""
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            result = yaml.safe_load(f)
        if isinstance(result, dict):
            return result
        return {}
    except Exception:
        return {}


def write_yaml(path: Path, data: dict) -> None:
    """Atomically write YAML."""
    content = yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False)
    with file_lock(path):
        atomic_write(path, content)


def read_markdown(path: Path) -> str:
    """Read markdown file, return empty string if missing."""
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def write_markdown(path: Path, content: str) -> None:
    """Atomically write markdown."""
    with file_lock(path):
        atomic_write(path, content)


def append_jsonl(path: Path, record: dict) -> None:
    """Append a JSON line to a JSONL file atomically."""
    path.parent.mkdir(parents=True, exist_ok=True)
    line = orjson.dumps(record).decode("utf-8") + "\n"
    with file_lock(path):
        with open(path, "a", encoding="utf-8") as f:
            f.write(line)


def read_json(path: Path) -> dict | list:
    """Read JSON file, return empty dict if missing."""
    if not path.exists():
        return {}
    return orjson.loads(path.read_bytes())


def write_json(path: Path, data: dict | list) -> None:
    """Atomically write JSON."""
    content = orjson.dumps(data, option=orjson.OPT_INDENT_2).decode("utf-8")
    with file_lock(path):
        atomic_write(path, content)


def read_jsonl(path: Path, limit: int = 100) -> list[dict]:
    """Read last N lines from JSONL file."""
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").strip().split("\n")
    lines = [l for l in lines if l.strip()]
    if limit:
        lines = lines[-limit:]
    return [orjson.loads(l) for l in lines]
