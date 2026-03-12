# VIBEOPS — DesignSpec (JSON2) Generation Prompt
You are a research lead and systems designer. You will be given:
(1) A literature review document (Markdown/TXT) produced from a corpus.
(2) Optional: the full literature CSV.

Your task: output a **single JSON object** called **DesignSpec** that defines:
- core innovation points
- a concrete method/framework
- detailed evaluation plan (datasets/baselines/metrics/ablations)
- an execution plan that can directly drive Vibe Coding / Vibe Research steps and Timeline
- an artifact plan (figures/tables/reports/code)

========================================================
CRITICAL OUTPUT RULES (MUST FOLLOW)
========================================================
1) Output **ONLY** valid JSON. No markdown fences. No commentary. No trailing commas.
2) Use double quotes for all strings.
3) Do NOT invent citations or paper IDs. If unsure, cite by paper title from the review text; otherwise use "N/A".
4) Be concrete and actionable—every step must have acceptance criteria and deliverables.
5) Minimum content requirements:
   - related_work_summary.themes length >= 4
   - innovation.core_claims length >= 3
   - method.architecture.modules length >= 4
   - evaluation.baselines length >= 5
   - evaluation.datasets length >= 2
   - execution_plan.vibe_coding_steps length between 10 and 18
   - execution_plan.vibe_research_steps length between 10 and 18
   - timeline.milestones length >= 6
   - artifact_plan length >= 12

========================================================
DESIGNSPEC JSON SCHEMA (MUST MATCH EXACTLY)
========================================================
Return a JSON object with this structure:

{
  "schema_version": 1,
  "project_id": "string",
  "topic": {
    "title": "string",
    "one_line": "string",
    "keywords": ["string"]
  },
  "related_work_summary": {
    "themes": [
      {
        "name": "string",
        "key_papers": ["string"],
        "limitations": ["string"]
      }
    ],
    "open_gaps": ["string"]
  },
  "innovation": {
    "core_claims": ["string"],
    "why_now": ["string"],
    "differentiators": ["string"]
  },
  "method": {
    "name": "string",
    "problem_definition": "string",
    "architecture": {
      "modules": [
        {
          "id": "M1",
          "name": "string",
          "inputs": ["string"],
          "outputs": ["string"],
          "notes": ["string"]
        }
      ],
      "dataflow": ["string"],
      "algorithms": [
        {
          "name": "string",
          "pseudo": "string"
        }
      ]
    },
    "training_or_optimization": {
      "losses": ["string"],
      "ablations": ["string"]
    }
  },
  "evaluation": {
    "datasets": [
      {
        "name": "string",
        "source": "string",
        "split": "string",
        "notes": "string"
      }
    ],
    "baselines": [
      {
        "name": "string",
        "type": "string",
        "why": "string"
      }
    ],
    "metrics": ["string"],
    "protocols": ["string"],
    "stress_tests": ["string"],
    "reproducibility": ["string"]
  },
  "execution_plan": {
    "vibe_coding_steps": [
      {
        "id": "VC-01",
        "title": "string",
        "goal": "string",
        "deliverables": ["string"],
        "acceptance": ["string"],
        "designspec_refs": ["string"],
        "prompt_short": "string",
        "prompt_expanded": "string"
      }
    ],
    "vibe_research_steps": [
      {
        "id": "VR-01",
        "title": "string",
        "goal": "string",
        "deliverables": ["string"],
        "acceptance": ["string"],
        "designspec_refs": ["string"],
        "prompt_short": "string",
        "prompt_expanded": "string"
      }
    ]
  },
  "timeline": {
    "milestones": [
      {
        "id": "T1",
        "title": "string",
        "target_date": "YYYY-MM-DD",
        "acceptance": ["string"],
        "linked_steps": ["string"]
      }
    ]
  },
  "artifact_plan": [
    {
      "type": "figure|table|code|dataset|report",
      "name": "string",
      "description": "string",
      "linked_steps": ["string"]
    }
  ]
}

========================================================
PROMPTING GUIDANCE (DO THIS)
========================================================
A) Read the literature review document and extract:
- 4–8 themes
- common architectures & evaluation patterns
- gaps and opportunities

B) Propose a method that is specific:
- at least 4 modules
- clear dataflow
- at least 1 algorithm pseudo section

C) Propose evaluation that is publishable:
- at least 2 datasets (even if you propose constructing one)
- at least 5 baselines (existing families)
- metrics + protocols + stress tests + reproducibility items

D) Execution plan MUST be structured in phases:
- Phase 0: Setup & repo scaffolding
- Phase 1: Data/Literature ingestion pipeline
- Phase 2: Core method implementation
- Phase 3: Evaluation harness + baselines
- Phase 4: Ablations + stress tests
- Phase 5: Writing + figures + finalization

Your VC steps must reflect engineering work; VR steps must reflect research writing and experiment planning.

========================================================
LONG EXAMPLE JSON (FOLLOW THIS STYLE; REPLACE CONTENT)
========================================================
{
  "schema_version": 1,
  "project_id": "demo-project",
  "topic": {
    "title": "Multi-Agent Literature Synthesis and Evaluation for AI Scientist Systems",
    "one_line": "A monitor-first research workspace that synthesizes literature and turns insights into a measurable evaluation + build plan.",
    "keywords": ["AI Scientist", "multi-agent", "literature synthesis", "evaluation", "research ops"]
  },
  "related_work_summary": {
    "themes": [
      {
        "name": "End-to-End AI Scientist Pipelines",
        "key_papers": ["N/A"],
        "limitations": ["Weak evaluation isolation (confounds in tool-use)", "Insufficient ablations on agent roles and memory"]
      },
      {
        "name": "Literature Retrieval and Synthesis Systems",
        "key_papers": ["N/A"],
        "limitations": ["Surface-level summaries without grounded comparison tables", "Limited error analysis on citation grounding"]
      },
      {
        "name": "Multi-Agent Orchestration Patterns",
        "key_papers": ["N/A"],
        "limitations": ["Role definitions are under-specified", "Little measurement of coordination cost vs gains"]
      },
      {
        "name": "Evaluation Frameworks for Agentic Systems",
        "key_papers": ["N/A"],
        "limitations": ["Non-reproducible evaluator/judge setups", "Missing stress tests and failure taxonomies"]
      }
    ],
    "open_gaps": [
      "A unified benchmark that evaluates both synthesis quality and downstream research decision quality",
      "A reproducible evaluation harness with controlled tool budgets and contamination checks",
      "A design spec that maps literature-derived hypotheses into concrete ablations and stress tests"
    ]
  },
  "innovation": {
    "core_claims": [
      "A DesignSpec-driven workflow that converts literature review into a structured, executable research plan and evaluation harness",
      "A modular architecture that separates retrieval, synthesis, critique, and evaluation into measurable modules",
      "A reporting-centric monitor that maintains audit-grade traces (events/logs/steps) to enable reproducible research ops"
    ],
    "why_now": [
      "Agentic research systems are proliferating but evaluation remains inconsistent and hard to reproduce",
      "Literature volume is exploding and individual researchers need disciplined synthesis-to-execution workflows"
    ],
    "differentiators": [
      "DesignSpec JSON2 as the canonical handoff artifact from review → innovation → execution",
      "Explicit stress tests (trigger noise, tool budget perturbation, role ablation) and reproducibility checklist",
      "Step-level prompts engineered for Claude Code vibe workflows (plan/implement/verify/report)"
    ]
  },
  "method": {
    "name": "DesignSpec-Guided ResearchOps Monitor",
    "problem_definition": "Given a literature corpus and a topic objective, produce a structured design spec that yields a reproducible build + evaluation plan and continuously tracks progress and artifacts.",
    "architecture": {
      "modules": [
        {
          "id": "M1",
          "name": "Corpus Normalizer",
          "inputs": ["CSV exports (Undermind/Zotero)", "paper metadata", "abstracts"],
          "outputs": ["normalized papers.jsonl", "tag index", "paper cards"],
          "notes": ["Deterministic parsing + field mapping", "Auto-tagging heuristics"]
        },
        {
          "id": "M2",
          "name": "Synthesis Builder",
          "inputs": ["normalized corpus", "review prompt output"],
          "outputs": ["review document", "theme map", "comparison tables"],
          "notes": ["No hallucinated citations; only corpus items allowed"]
        },
        {
          "id": "M3",
          "name": "DesignSpec Composer",
          "inputs": ["review document", "gap list", "constraints"],
          "outputs": ["DesignSpec.json", "execution steps", "timeline milestones"],
          "notes": ["Strict schema; includes method/eval/plan/artifacts"]
        },
        {
          "id": "M4",
          "name": "Execution & Reporting Layer",
          "inputs": ["DesignSpec", "user logs", "step status", "artifact registry"],
          "outputs": ["daily/weekly reports", "activity events stream", "audit trail"],
          "notes": ["Event-based aggregation; per-project rollups"]
        }
      ],
      "dataflow": [
        "CSV import -> Normalize -> Tag",
        "Normalize -> Review synthesis",
        "Review -> DesignSpec",
        "DesignSpec -> Steps/Timeline/Artifacts",
        "Steps/Logs/Artifacts -> Reports"
      ],
      "algorithms": [
        {
          "name": "Auto-Tag Heuristic",
          "pseudo": "For each paper: tokenize title+abstract; match keyword dictionaries; assign top 1–3 tags; default 'untagged' if none."
        }
      ]
    },
    "training_or_optimization": {
      "losses": ["N/A (monitor-only system)"],
      "ablations": ["Tagging dictionary variants", "Theme granularity variants", "Prompt structure variants"]
    }
  },
  "evaluation": {
    "datasets": [
      {
        "name": "Internal Corpus Export Set",
        "source": "Undermind/Zotero exports",
        "split": "by year and by topic subtheme",
        "notes": "Used to evaluate synthesis stability and table completeness"
      },
      {
        "name": "Synthetic Benchmark Tasks",
        "source": "curated tasks aligned with themes",
        "split": "train/dev/test by task family",
        "notes": "Used to evaluate whether DesignSpec improves downstream execution clarity"
      }
    ],
    "baselines": [
      { "name": "Plain notes (no schema)", "type": "workflow", "why": "common manual approach" },
      { "name": "CSV -> summary (no tables)", "type": "synthesis", "why": "weak baseline" },
      { "name": "Template-only (no DesignSpec)", "type": "planning", "why": "tests DesignSpec value" },
      { "name": "No event stream reporting", "type": "monitoring", "why": "tests reporting value" },
      { "name": "No tag heuristics", "type": "literature", "why": "tests categorization impact" }
    ],
    "metrics": [
      "Table completeness (required fields filled)",
      "Theme coverage (>=4 themes)",
      "Actionability score (steps have acceptance)",
      "Reproducibility checklist coverage"
    ],
    "protocols": [
      "Generate review from corpus; verify no hallucinated references",
      "Generate DesignSpec from review; validate schema; validate minimum counts",
      "Apply DesignSpec to project; verify steps/timeline/artifacts updated"
    ],
    "stress_tests": [
      "Missing abstracts for 30% of papers",
      "No citations field available",
      "Highly overlapping themes (dedup challenge)"
    ],
    "reproducibility": [
      "All artifacts stored under projects/<id>",
      "Event stream is append-only JSONL",
      "Reports include deterministic summaries and timestamps"
    ]
  },
  "execution_plan": {
    "vibe_coding_steps": [
      {
        "id": "VC-01",
        "title": "Repo scaffold and data paths",
        "goal": "Ensure project directory layout and atomic writes are correct.",
        "deliverables": ["verified folder structure", "atomic write helper", "smoke test script"],
        "acceptance": ["npm build passes", "api health ok", "no blank pages"],
        "designspec_refs": ["M4"],
        "prompt_short": "Implement repo scaffold checks and atomic writes. Verify with build+curl.",
        "prompt_expanded": "PLAN: list touched files. IMPLEMENT: add atomic write helper + tests. VERIFY: npm run build, curl endpoints. REPORT: write summary of changes and commands."
      }
      // ... In your actual output, provide 10–18 VC steps total (no comments allowed in JSON)
    ],
    "vibe_research_steps": [
      {
        "id": "VR-01",
        "title": "Theme taxonomy and gap list finalization",
        "goal": "Turn review into a stable theme taxonomy and gap list for the paper.",
        "deliverables": ["theme map", "gap list", "paper outline section headings"],
        "acceptance": [">=4 themes", ">=8 gaps", "each gap mapped to eval item"],
        "designspec_refs": ["related_work_summary"],
        "prompt_short": "Extract themes+gaps from review and format as paper-ready bullets.",
        "prompt_expanded": "PLAN: define 4–8 themes, 8–15 gaps. IMPLEMENT: write concise bullets and mapping. VERIFY: no hallucinated citations. REPORT: deliver markdown outline."
      }
      // ... Provide 10–18 VR steps total
    ]
  },
  "timeline": {
    "milestones": [
      {
        "id": "T1",
        "title": "DesignSpec validated and applied",
        "target_date": "2026-03-10",
        "acceptance": ["DesignSpec schema valid", "overview updated", "steps regenerated"],
        "linked_steps": ["VC-01", "VR-01"]
      },
      {
        "id": "T2",
        "title": "Baseline evaluation harness ready",
        "target_date": "2026-03-20",
        "acceptance": [">=5 baselines defined", "metrics/protocols implemented", "report generated"],
        "linked_steps": ["VC-02", "VC-03"]
      },
      {
        "id": "T3",
        "title": "Stress tests + ablation plan ready",
        "target_date": "2026-03-28",
        "acceptance": [">=3 stress tests", "ablation matrix defined", "analysis template created"],
        "linked_steps": ["VR-05", "VC-06"]
      },
      {
        "id": "T4",
        "title": "Paper draft v1 completed",
        "target_date": "2026-04-05",
        "acceptance": ["intro+method+exp written", "figures planned", "related work aligned"],
        "linked_steps": ["VR-08", "VR-10"]
      },
      {
        "id": "T5",
        "title": "Paper draft v2 + experiments completed",
        "target_date": "2026-04-20",
        "acceptance": ["main results table complete", "ablations run", "error analysis done"],
        "linked_steps": ["VC-10", "VR-12"]
      },
      {
        "id": "T6",
        "title": "Submission-ready package",
        "target_date": "2026-05-01",
        "acceptance": ["camera-ready formatting", "repro checklist done", "artifact bundle ready"],
        "linked_steps": ["VC-14", "VR-16"]
      }
    ]
  },
  "artifact_plan": [
    { "type": "figure", "name": "System overview diagram", "description": "Architecture modules and dataflow", "linked_steps": ["VC-05", "VR-06"] },
    { "type": "table", "name": "Scope alignment matrix", "description": "Theme x capability table", "linked_steps": ["VR-02"] },
    { "type": "table", "name": "Evaluation matrix", "description": "Baselines/datasets/metrics", "linked_steps": ["VR-04"] },
    { "type": "report", "name": "Daily progress report template", "description": "Auto-generated from events", "linked_steps": ["VC-03"] },
    { "type": "code", "name": "Corpus normalizer", "description": "CSV parsing and normalization", "linked_steps": ["VC-02"] },
    { "type": "code", "name": "Tagging heuristics", "description": "Keyword-to-tag mapping", "linked_steps": ["VC-04"] },
    { "type": "code", "name": "Report aggregator", "description": "Events to daily/weekly summaries", "linked_steps": ["VC-07"] },
    { "type": "dataset", "name": "Normalized papers.jsonl", "description": "Unified literature store", "linked_steps": ["VC-02"] },
    { "type": "report", "name": "Literature review report", "description": "Undermind-style synthesis output", "linked_steps": ["VR-03"] },
    { "type": "figure", "name": "Ablation/stress test chart", "description": "Stress test outcomes visualization", "linked_steps": ["VC-11"] },
    { "type": "report", "name": "Reproducibility checklist", "description": "Checklist and confirmations", "linked_steps": ["VR-14"] },
    { "type": "code", "name": "Baseline harness", "description": "Baseline runners and config", "linked_steps": ["VC-09"] }
  ]
}

========================================================
NOW YOUR TURN
========================================================
Read the provided literature review text. Infer the topic and constraints.
Then output a single DesignSpec JSON object that strictly matches the schema and meets minimum counts.
Remember: JSON only, no markdown.