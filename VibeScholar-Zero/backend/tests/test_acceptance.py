"""Acceptance tests for vibeCR — verifies all phases."""

import requests
import json

BASE = "http://127.0.0.1:8007/api/v1"
PASS = 0
FAIL = 0


def check(name: str, condition: bool, detail: str = ""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        print(f"  ✗ {name} — {detail}")


def test_phase0():
    print("\n── PHASE 0: Scaffolding ──")
    r = requests.get(f"{BASE}/health")
    check("Health endpoint returns 200", r.status_code == 200)
    d = r.json()
    check("Health status is ok", d.get("status") == "ok")
    check("App name is vibeCR", d.get("app") == "vibeCR")
    check("Version present", "version" in d)


def test_phase1():
    print("\n── PHASE 1: Projects + Overviews ──")
    r = requests.get(f"{BASE}/projects")
    check("Projects endpoint returns 200", r.status_code == 200)
    projects = r.json()
    check("10 projects returned", len(projects) == 10, f"got {len(projects)}")

    expected_ids = [
        "synth-benchmark", "vibe-coding-book", "vibe-research-survey",
        "vibe-paper-reading", "badclaw", "badskill",
        "task-feature-atlas", "neuroguard", "uncertainty-engine", "openclaw-bias",
    ]
    actual_ids = [p["id"] for p in projects]
    check("All expected project IDs present", set(expected_ids) == set(actual_ids),
          f"missing: {set(expected_ids) - set(actual_ids)}")

    for pid in expected_ids:
        r = requests.get(f"{BASE}/projects/{pid}")
        check(f"Project {pid} detail returns 200", r.status_code == 200)
        d = r.json()
        check(f"Project {pid} has name", bool(d.get("name")), "empty name")
        check(f"Project {pid} has definition", bool(d.get("definition")), "empty definition")
        check(f"Project {pid} has overview_md", len(d.get("overview_md", "")) > 500,
              f"overview too short: {len(d.get('overview_md', ''))} chars")

    # Check overview has all 11 sections
    r = requests.get(f"{BASE}/projects/synth-benchmark/content/overview")
    content = r.json().get("content", "")
    for section in ["One-line Definition", "Why it matters", "Scope & Non-scope",
                     "Key Questions", "Core Concepts", "Proposed System",
                     "Evaluation Plan", "Deliverables", "Milestones",
                     "Risks & Mitigations", "Literature Entry Points", "Next Actions"]:
        check(f"Overview contains '{section}'", section in content, "section missing")


def test_phase2():
    print("\n── PHASE 2: Execution (VC/VR Checklists + Logs) ──")
    # Checklists
    r = requests.get(f"{BASE}/projects/synth-benchmark/checklists/coding")
    check("Checklist GET returns 200", r.status_code == 200)
    items = r.json().get("items", [])
    check("Checklist has items", len(items) > 0, f"got {len(items)}")

    doing = [i for i in items if i["status"] == "doing"]
    check("Has a 'doing' item (current step)", len(doing) > 0)

    # Current step shows in project summary
    r = requests.get(f"{BASE}/projects/synth-benchmark")
    d = r.json()
    check("vc_current_step populated", bool(d.get("vc_current_step")))
    check("vr_current_step populated", bool(d.get("vr_current_step")))

    # Add checklist item
    r = requests.post(f"{BASE}/projects/synth-benchmark/checklists/coding/items",
                       json={"text": "Test item from acceptance test", "status": "todo"})
    check("Add checklist item returns 200", r.status_code == 200)

    # Update checklist item
    item_id = r.json()["id"]
    r = requests.patch(f"{BASE}/projects/synth-benchmark/checklists/coding/items/{item_id}",
                        json={"status": "done"})
    check("Update checklist item returns 200", r.status_code == 200)
    check("Item status updated to done", r.json()["status"] == "done")

    # Logs
    r = requests.post(f"{BASE}/projects/synth-benchmark/logs/coding",
                       json={"type": "progress", "summary": "Acceptance test log entry", "duration_min": 10})
    check("Add log returns 200", r.status_code == 200)

    r = requests.get(f"{BASE}/projects/synth-benchmark/logs/coding?limit=5")
    check("Get logs returns 200", r.status_code == 200)
    logs = r.json()
    check("Logs returned", len(logs) > 0)

    # Progress updates after checklist changes
    r = requests.get(f"{BASE}/projects/synth-benchmark")
    d = r.json()
    check("vc_progress computed", d.get("vc_progress", -1) >= 0)


def test_phase3():
    print("\n── PHASE 3: Plans ──")
    # Save plan
    r = requests.put(f"{BASE}/projects/synth-benchmark/plans/experiment",
                      json={"content": "# Test Plan\n\nThis is a test experiment plan."})
    check("Save plan returns 200", r.status_code == 200)

    # Read plan
    r = requests.get(f"{BASE}/projects/synth-benchmark/plans/experiment")
    check("Get plan returns 200", r.status_code == 200)
    check("Plan content saved", "test experiment plan" in r.json().get("content", "").lower())

    # Paper plan
    r = requests.put(f"{BASE}/projects/synth-benchmark/plans/paper",
                      json={"content": "# Paper Plan\n\n## Target venue\n- NeurIPS 2026"})
    check("Save paper plan returns 200", r.status_code == 200)


def test_phase4():
    print("\n── PHASE 4: Literature ──")
    # Search
    r = requests.get(f"{BASE}/literature/papers?query=reinforcement&limit=5")
    check("Search returns 200", r.status_code == 200)
    papers = r.json()
    check("Search returns results", len(papers) > 0)
    check("Paper has title", bool(papers[0].get("title")))
    check("Paper has paper_id", bool(papers[0].get("paper_id")))

    # Import (should show all duplicates since already imported)
    r = requests.post(f"{BASE}/literature/import")
    check("Import returns 200", r.status_code == 200)
    d = r.json()
    check("Import reports duplicates", d.get("duplicates", 0) > 0)

    # Paper notes
    pid = papers[0]["paper_id"]
    r = requests.put(f"{BASE}/literature/papers/{pid}/notes",
                      json={"content": "# Test note\n\nThis is a test note."})
    check("Save paper notes returns 200", r.status_code == 200)

    r = requests.get(f"{BASE}/literature/papers/{pid}/notes")
    check("Get paper notes returns 200", r.status_code == 200)
    check("Notes content saved", "test note" in r.json().get("content", "").lower())

    # Paper tags
    r = requests.put(f"{BASE}/literature/papers/{pid}/tags",
                      json={"tags": ["multi-agent", "RL"], "projects": ["synth-benchmark"], "pinned": True})
    check("Save paper tags returns 200", r.status_code == 200)


def test_phase5():
    print("\n── PHASE 5: Reports ──")
    r = requests.post(f"{BASE}/reports/daily", json={"date": "2026-03-03"})
    check("Daily report generation returns 200", r.status_code == 200)
    d = r.json()
    check("Daily report has content", len(d.get("content", "")) > 0)
    check("Daily report has path", bool(d.get("path")))

    r = requests.post(f"{BASE}/reports/weekly", json={})
    check("Weekly report generation returns 200", r.status_code == 200)
    d = r.json()
    check("Weekly report has content", len(d.get("content", "")) > 0)
    check("Weekly report has portfolio summary", "Portfolio Summary" in d.get("content", ""))


def test_phase6():
    print("\n── PHASE 6: Product Polish ──")
    # Artifacts
    r = requests.post(f"{BASE}/projects/synth-benchmark/artifacts",
                       json={"type": "code", "name": "synthesis-engine", "description": "Core synthesis pipeline"})
    check("Add artifact returns 200", r.status_code == 200)

    r = requests.get(f"{BASE}/projects/synth-benchmark/artifacts")
    check("Get artifacts returns 200", r.status_code == 200)
    check("Artifact returned", len(r.json()) > 0)

    # PATCH project
    r = requests.patch(f"{BASE}/projects/synth-benchmark",
                        json={"rag": "amber", "priority": "P0"})
    check("Patch project returns 200", r.status_code == 200)
    check("RAG updated", r.json().get("rag") == "amber")

    # 404 for missing project
    r = requests.get(f"{BASE}/projects/nonexistent")
    check("Missing project returns 404", r.status_code == 404)

    # All projects have sortable fields
    r = requests.get(f"{BASE}/projects")
    projects = r.json()
    for p in projects:
        check(f"{p['id']} has priority", bool(p.get("priority")), "missing priority")
        check(f"{p['id']} has rag", bool(p.get("rag")), "missing rag")
        check(f"{p['id']} has pillar", bool(p.get("pillar")), "missing pillar")


if __name__ == "__main__":
    print("=" * 60)
    print("vibeCR Acceptance Tests")
    print("=" * 60)

    test_phase0()
    test_phase1()
    test_phase2()
    test_phase3()
    test_phase4()
    test_phase5()
    test_phase6()

    print(f"\n{'=' * 60}")
    print(f"Results: {PASS} passed, {FAIL} failed, {PASS + FAIL} total")
    print(f"{'=' * 60}")

    exit(0 if FAIL == 0 else 1)
