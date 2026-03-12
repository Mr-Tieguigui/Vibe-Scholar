# Getting Started with VibeScholar

## Welcome

Welcome to **VibeScholar** — an opinionated research-operations platform that helps you plan, execute, and track AI/ML research projects from idea to publication.

This is the minimal (zero) release. It ships with this single Getting Started project so you can explore the platform and create your own projects from scratch.

## What is VibeScholar?

VibeScholar organizes every research project into five pillars:

1. **Overview** — Structured project definition with motivation, scope, questions, and risks
2. **Execution** — Phased Vibe Coding (VC) and Vibe Research (VR) steps with prompts and acceptance criteria
3. **Timeline** — Milestone-based tracking with Kanban view and deadline management
4. **Artifacts** — Registry of code, datasets, figures, tables, and reports linked to milestones
5. **Literature** — Imported papers with tags, summaries, and normalized metadata

## Quick Start

### Step 1 — Create Your First Project
Use the dashboard to create a new project. Give it a name, definition, and domain tags.

### Step 2 — Write an Overview
Open your project and write a structured overview with sections for Definition, Motivation, Scope, Research Questions, and Risks.

### Step 3 — Add Execution Steps
Create Vibe Coding steps for implementation work and Vibe Research steps for writing and analysis.

### Step 4 — Set Milestones
Add milestones with deadlines and acceptance criteria. Track progress in the Kanban view.

### Step 5 — Import Literature
Import papers via CSV or JSONL. Tag them for filtering and reference in your research steps.

## Key Concepts

- **Vibe Coding (VC):** Implementation-focused steps — code, tests, infrastructure, packaging
- **Vibe Research (VR):** Research-focused steps — literature review, experimental design, writing, figures
- **Phase Grouping:** Steps are organized into 6 phases (0-5) from setup to finalization
- **DesignSpec:** A structured project specification that auto-generates execution steps, milestones, and artifacts
- **RAG Status:** Red/Amber/Green health indicator per project

## Want More?

For a full demo with 62 pre-loaded projects across 16 research domains, check out **vibeops** (the full release): https://github.com/vibeops/vibeops
