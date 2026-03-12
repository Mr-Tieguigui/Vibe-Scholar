# Gold Standard Project QA Checklist

**Project:** `gold-benchmark-agentic-researchops`
**Title:** Tool-Budget Robustness Benchmark for Agentic Research Systems
**Validated:** 2025-03-06

## Structural Checks

| Check | Required | Actual | Status |
|-------|----------|--------|--------|
| `overview.json` sections | ≥ 11 | 11 | PASS |
| `overview.json` section types | motivation, text, pipeline, evaluation, risks, deliverables, literature | All present | PASS |
| `vc_steps.yaml` step count | 10–14 | 12 | PASS |
| `vc_steps.yaml` phases covered | 0–5 | {0,1,2,3,4,5} | PASS |
| `vr_steps.yaml` step count | 10–14 | 10 | PASS |
| `vr_steps.yaml` phases covered | 0–5 | {0,1,2,3,4,5} | PASS |
| `artifacts/index.yaml` count | ≥ 18 | 20 | PASS |
| `timeline/milestones.yaml` count | ≥ 8 | 8 | PASS |
| `literature/normalized/papers.jsonl` count | ≥ 10 | 12 | PASS |
| `checklists/vibe_coding.yaml` items | matches VC steps | 12 = 12 | PASS |
| `checklists/vibe_research.yaml` items | matches VR steps | 10 = 10 | PASS |

## Content Quality Checks

| Check | Status |
|-------|--------|
| All VC steps have `prompt_expanded` (multi-line, detailed) | PASS |
| All VC steps have `prompt_hint` (one-line) | PASS |
| All VC steps have `deliverables` list | PASS |
| All VC steps have `acceptance` criteria | PASS |
| All VC steps have `designspec_refs` | PASS |
| All VR steps have `prompt_expanded` | PASS |
| All VR steps have `prompt_hint` | PASS |
| All VR steps have `deliverables` list | PASS |
| All artifacts have `type`, `name`, `description`, `linked_milestone` | PASS |
| All milestones have `acceptance`, `deadline`, `status` | PASS |
| All literature entries have `title`, `year`, `venue`, `tags`, `summary` | PASS |
| `overview.md` exists and matches `overview.json` title | PASS |
| `project.yaml` has `id`, `name`, `definition`, `pillar`, `tags` | PASS |

## Domain Coverage

| Domain Tag | Present |
|------------|---------|
| Evaluation & Benchmarking | YES |
| Agentic Systems | YES |
| Systems & Tooling | YES |

## English-Only Check

- No Chinese characters in any project file: **PASS**
- No private paths or usernames: **PASS**

## Rendering Notes

- The `overview.json` is consumed by the structured overview API endpoint
- VC/VR steps render in the execution panel with phase grouping
- Artifacts render in the artifacts panel with type icons
- Milestones render in the timeline Kanban view
- Literature renders in the literature panel with tag filtering

## Summary

The Gold Standard project meets all quantitative requirements and serves as the
template for the 60 generated demo projects. The demo projects use the same
directory structure and file schemas but with templated content.
