# VibeScholar — Project Content Template Prompt

You are helping me create a complete, structured project plan for a research/engineering project.

## Your Task

I will provide a core description of my project below. Based on this description, you must generate a **complete JSON object** that I will upload into my project management tool (VibeScholar).

**CRITICAL: Return ONLY valid JSON. No markdown fences, no commentary, no explanation. ONLY the JSON object.**

---

## Core Description

{{CORE_DESCRIPTION}}

---

## Output Requirements

**CRITICAL: Return ONLY valid JSON. No markdown fences. No text before or after the JSON.**

You must produce a single JSON object with the following top-level structure. Every field is required unless marked optional.

```
{
  "id": "<lowercase-slug>",
  "name": "<project display name>",
  "name_en": "<English display name>",
  "definition": "<one-sentence project definition>",
  "pillar": "<research area, e.g. 'Safety', 'Methods', 'Applications'>",
  "tags": ["tag1", "tag2", ...],
  "priority": "P0|P1|P2|P3",

  "overview": {
    "definition": "<2-4 sentence expanded definition>",
    "motivation": "<why this matters, 3-5 sentences>",
    "scope": "<what is in scope and out of scope>",
    "questions": ["research question 1", "research question 2", ...],
    "concepts": [
      { "term": "<key term>", "description": "<definition>" }
    ],
    "pipeline": [
      { "step": "<pipeline stage>", "description": "<what happens>" }
    ],
    "evaluation": [
      { "label": "<metric name>", "value": "<target or description>" }
    ],
    "deliverables": ["deliverable 1", "deliverable 2", ...],
    "milestones": [
      {
        "id": "M1",
        "title": "<milestone title>",
        "week": "Week 1-2",
        "acceptance": "<concrete acceptance criteria>"
      }
    ],
    "risks": [
      { "risk": "<risk description>", "mitigation": "<mitigation strategy>" }
    ],
    "literature": [
      { "label": "<category>", "value": "<key papers or topics>" }
    ],
    "next_actions": ["action 1", "action 2", ...]
  },

  "execution": {
    "vc_steps": [
      {
        "id": "vc-01",
        "title": "<step title>",
        "description": "<detailed description of what to implement>",
        "acceptance": "<concrete acceptance criteria>",
        "section": "<category: setup|core|integration|testing|deployment>",
        "prompt_hint": "<a prompt you could give to an AI coding agent to complete this step>",
        "linked_milestone": "M1"
      }
    ],
    "vr_steps": [
      {
        "id": "vr-01",
        "title": "<step title>",
        "description": "<detailed description of what to research>",
        "acceptance": "<concrete acceptance criteria>",
        "section": "<category: literature|experiment|analysis|writing|review>",
        "prompt_hint": "<a prompt you could give to an AI research agent to complete this step>",
        "linked_milestone": "M1"
      }
    ]
  },

  "artifacts": [
    {
      "type": "code|dataset|paper|figure|table|demo|report|other",
      "name": "<artifact name>",
      "description": "<what this artifact is>",
      "linked_step": "vc-01"
    }
  ]
}
```

## Minimum Content Requirements (MUST meet all)

| Section | Minimum |
|---|---|
| overview.sections (non-empty fields) | >= 8 |
| overview.questions | >= 3 |
| overview.concepts | >= 5 |
| overview.pipeline | >= 4 |
| overview.milestones | >= 6 |
| overview.risks | >= 4 |
| overview.deliverables | >= 6 |
| execution.vc_steps | 10–18 steps |
| execution.vr_steps | 10–18 steps |
| artifacts | >= 12 |

## Quality Rules

1. **Be specific and actionable.** Every step must describe a concrete action, not a vague goal.
2. **No placeholders.** Never write "TBD", "TODO", "to be determined", or "[fill in]". Write real content.
3. **Include acceptance criteria everywhere.** Every milestone and every step must have a clear, testable acceptance criterion.
4. **Prompt hints must be usable.** Each `prompt_hint` should be a complete, copy-pastable prompt for an AI coding/research agent (Cursor, Windsurf, Claude Code, etc.).
5. **Milestones must have week ranges.** Use "Week X-Y" format.
6. **Artifacts must link to steps.** Each artifact should reference the step that produces it.
7. **Steps must link to milestones.** Each step should reference which milestone it belongs to.
8. **Literature section must reference real research areas**, not made-up papers.

## Validation Checklist (check before returning)

- [ ] The JSON is valid (no trailing commas, no comments)
- [ ] `id` is a lowercase slug with hyphens only
- [ ] All arrays have the minimum required number of items
- [ ] No field contains "TBD", "TODO", or placeholder text
- [ ] Every milestone has `id`, `title`, `week`, and `acceptance`
- [ ] Every vc_step and vr_step has `id`, `title`, `description`, `acceptance`, `section`, `prompt_hint`
- [ ] Every artifact has `type`, `name`, `description`, `linked_step`
- [ ] `prompt_hint` fields contain complete, actionable prompts (not just "implement X")
- [ ] The overview sections tell a coherent story from motivation through execution

## Rich Example

Here is a realistic example of a well-filled template (abbreviated for space):

```json
{
  "id": "llm-safety-audit",
  "name": "LLM Safety Audit Framework",
  "name_en": "LLM Safety Audit Framework",
  "definition": "A systematic framework for auditing large language model safety properties including toxicity, bias, and hallucination rates.",
  "pillar": "Safety",
  "tags": ["safety", "audit", "llm", "evaluation", "bias"],
  "priority": "P1",
  "overview": {
    "definition": "This project develops a comprehensive, reproducible framework for auditing the safety properties of large language models. The framework covers toxicity detection, demographic bias measurement, hallucination rate estimation, and prompt injection vulnerability assessment. It produces standardized audit reports that can be compared across models and versions.",
    "motivation": "As LLMs are deployed in high-stakes applications (healthcare, legal, education), systematic safety evaluation is critical. Current evaluation approaches are fragmented and non-standardized. Organizations need a unified audit protocol that covers the key safety dimensions and produces actionable reports with clear pass/fail criteria.",
    "scope": "In scope: toxicity benchmarks, bias probes, hallucination detection, prompt injection tests, automated report generation. Out of scope: model training, fine-tuning interventions, real-time monitoring (future work).",
    "questions": [
      "What is the minimum set of safety dimensions that constitutes a comprehensive audit?",
      "How can we standardize safety metrics across different model architectures?",
      "What threshold values should trigger a 'fail' result for each safety dimension?",
      "How do safety properties degrade under adversarial prompting?"
    ],
    "concepts": [
      { "term": "Toxicity Score", "description": "Probability that generated text contains harmful, offensive, or inappropriate content, measured via classifier ensemble." },
      { "term": "Demographic Parity", "description": "Measure of whether model outputs are statistically independent of protected attributes like gender, race, age." },
      { "term": "Hallucination Rate", "description": "Fraction of generated claims that cannot be grounded in the provided context or known facts." },
      { "term": "Prompt Injection", "description": "Attack where adversarial instructions in user input override system-level safety constraints." },
      { "term": "Red-teaming", "description": "Systematic adversarial testing where human evaluators attempt to elicit unsafe model behaviors." }
    ],
    "pipeline": [
      { "step": "Benchmark Selection", "description": "Curate and validate benchmark datasets for each safety dimension (toxicity, bias, hallucination, injection)." },
      { "step": "Probe Design", "description": "Design standardized probe templates that test each safety dimension with controlled inputs." },
      { "step": "Automated Evaluation", "description": "Run model inference on all probes, collect outputs, compute safety metrics using classifier ensemble." },
      { "step": "Report Generation", "description": "Aggregate metrics into standardized audit report with pass/fail verdicts and confidence intervals." },
      { "step": "Comparative Analysis", "description": "Compare audit results across model versions and architectures to identify trends." }
    ],
    "evaluation": [
      { "label": "Toxicity Detection F1", "value": ">= 0.92 on ToxiGen benchmark" },
      { "label": "Bias Probe Coverage", "value": ">= 12 demographic dimensions tested" },
      { "label": "Hallucination Detection Accuracy", "value": ">= 0.85 on SelfCheckGPT" },
      { "label": "Report Generation Time", "value": "< 30 minutes per model audit" }
    ],
    "deliverables": [
      "Safety audit framework codebase (Python package)",
      "Benchmark dataset collection (curated, versioned)",
      "Probe template library (>200 templates)",
      "Automated report generator (HTML + JSON output)",
      "Comparative analysis dashboard",
      "Technical report documenting methodology and validation"
    ],
    "milestones": [
      { "id": "M1", "title": "Benchmark Curation", "week": "Week 1-2", "acceptance": "All 4 safety dimension benchmarks curated, validated with >1000 examples each, documented in data cards." },
      { "id": "M2", "title": "Probe Library v1", "week": "Week 3-4", "acceptance": "200+ probe templates covering all dimensions, with expected-output annotations, unit tests passing." },
      { "id": "M3", "title": "Evaluation Pipeline", "week": "Week 5-7", "acceptance": "End-to-end pipeline runs on GPT-4 and Llama-3, produces metrics JSON, <5% variance across runs." },
      { "id": "M4", "title": "Report Generator", "week": "Week 8-9", "acceptance": "HTML report auto-generated from metrics, includes charts, pass/fail verdicts, comparison tables." },
      { "id": "M5", "title": "Validation Study", "week": "Week 10-11", "acceptance": "Audit 5 models, compare results with published safety evaluations, correlation >0.8." },
      { "id": "M6", "title": "Documentation & Release", "week": "Week 12", "acceptance": "README, API docs, example notebooks, PyPI package published, technical report submitted." }
    ],
    "risks": [
      { "risk": "Benchmark contamination in training data", "mitigation": "Use held-out test sets and novel probe templates not in common benchmarks." },
      { "risk": "Classifier ensemble disagreement", "mitigation": "Use majority voting with calibrated confidence thresholds." },
      { "risk": "Model API rate limits", "mitigation": "Implement batching, caching, and exponential backoff." },
      { "risk": "Rapidly evolving model landscape", "mitigation": "Design modular architecture allowing easy addition of new models and metrics." }
    ],
    "literature": [
      { "label": "Toxicity", "value": "ToxiGen, RealToxicityPrompts, Perspective API studies" },
      { "label": "Bias", "value": "BBQ Benchmark, WinoBias, StereoSet, demographic parity frameworks" },
      { "label": "Hallucination", "value": "SelfCheckGPT, FactScore, FEVER-based approaches" },
      { "label": "Red-teaming", "value": "Anthropic red-team studies, PAIR attack, GCG adversarial suffixes" }
    ],
    "next_actions": [
      "Set up project repository with CI/CD pipeline",
      "Download and validate ToxiGen and BBQ benchmark datasets",
      "Draft probe template format specification",
      "Benchmark Perspective API classifier on validation set"
    ]
  },
  "execution": {
    "vc_steps": [
      {
        "id": "vc-01",
        "title": "Project scaffolding and CI setup",
        "description": "Create Python package structure with pyproject.toml, configure GitHub Actions for testing and linting, set up pre-commit hooks.",
        "acceptance": "Package installable via pip install -e ., CI runs pytest and ruff on every push, pre-commit hooks configured.",
        "section": "setup",
        "prompt_hint": "Create a Python package called 'llm-safety-audit' with src layout, pyproject.toml with pytest/ruff/mypy dev deps, GitHub Actions CI workflow, and pre-commit config. Include a basic conftest.py and one passing test.",
        "linked_milestone": "M1"
      },
      {
        "id": "vc-02",
        "title": "Benchmark data loader module",
        "description": "Implement data loader classes for ToxiGen, BBQ, SelfCheckGPT, and custom probe datasets. Each loader normalizes to a common schema.",
        "acceptance": "All 4 loaders implemented, each returns list[Probe] with text/expected/dimension fields, unit tests cover edge cases.",
        "section": "core",
        "prompt_hint": "Implement a DataLoader base class and 4 concrete loaders (ToxiGenLoader, BBQLoader, SelfCheckLoader, CustomProbeLoader) that each load their respective datasets and return normalized Probe objects. Include type hints, docstrings, and pytest tests.",
        "linked_milestone": "M1"
      }
    ],
    "vr_steps": [
      {
        "id": "vr-01",
        "title": "Survey existing safety evaluation frameworks",
        "description": "Conduct a systematic literature review of LLM safety evaluation approaches published 2022-2024, focusing on methodology, metrics, and reproducibility.",
        "acceptance": "Annotated bibliography with 20+ papers, comparison table of approaches, identified gaps documented in literature review section.",
        "section": "literature",
        "prompt_hint": "Search for papers on 'LLM safety evaluation' and 'language model auditing' from 2022-2024. For each paper, extract: title, authors, year, method summary, metrics used, key findings, limitations. Create a comparison table and identify 3 research gaps.",
        "linked_milestone": "M1"
      }
    ]
  },
  "artifacts": [
    { "type": "code", "name": "llm-safety-audit Python package", "description": "Main codebase with data loaders, evaluation pipeline, and report generator", "linked_step": "vc-01" },
    { "type": "dataset", "name": "Curated benchmark collection", "description": "Validated datasets for toxicity, bias, hallucination, and injection testing", "linked_step": "vc-02" },
    { "type": "code", "name": "Probe template library", "description": "200+ standardized probe templates in JSON format", "linked_step": "vc-03" },
    { "type": "report", "name": "Technical methodology report", "description": "Detailed documentation of audit methodology, metrics, and validation results", "linked_step": "vr-01" }
  ]
}
```

(The above is abbreviated — your output must include ALL sections fully populated with the minimum counts specified.)

**CRITICAL: Return ONLY valid JSON. No markdown fences, no commentary, no explanation. Start with `{` and end with `}`.**
