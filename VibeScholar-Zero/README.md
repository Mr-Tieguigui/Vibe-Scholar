<p align="center">
  <img src="docs/images/icon.svg" alt="VibeScholar" width="64"/>
</p>

<h1 align="center">VibeScholar-Zero</h1>

<p align="center">
  <b>Clean Starter Edition — Start Your Research from Scratch</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Projects-1_(Getting_Started)-4f46e5?style=flat-square" alt="Projects"/>
</p>

---

## What is VibeScholar-Zero?

**VibeScholar-Zero** is the minimal, clean-slate edition of [VibeScholar](YOUR_GITHUB_LINK_HERE). It ships with:

- **1 project** — the Getting Started tutorial
- **Same codebase** — identical backend, frontend, and template system
- **No demo data** — perfect for building your own research workspace from day one

> Looking for the full edition with 62 demo projects across 16 research domains? See the [main VibeScholar repository](YOUR_GITHUB_LINK_HERE).

---

## Quickstart

```bash
# Install dependencies
cd backend && pip install -r requirements.txt && cd ..
cd frontend && npm install && npm run build && cd ..

# Start the server
python3 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8007
```

Open **http://127.0.0.1:8007** in your browser.

---

## Creating Your First Project

1. Open the dashboard and click **"+ New Project"**
2. Fill in the project name, domain, and priority
3. Download the **JSON template** from the project page
4. Copy the embedded prompt into any LLM (ChatGPT / Claude / Gemini)
5. Paste your research topic and let the LLM fill the template
6. Upload the filled JSON back to VibeScholar
7. The system auto-generates: overview, execution steps, milestones, and artifact index

---

## Project Structure

```
VibeScholar-Zero/
├── backend/           # FastAPI backend (identical to full edition)
├── frontend/          # React 18 + TypeScript + TailwindCSS v4
├── config/            # Project registry, AI providers, UI theme
├── projects/          # 1 project: getting-started
├── templates/         # JSON/YAML project templates + LLM prompts
├── scripts/           # deploy_prod.sh
├── DEV_GUIDE.md       # Developer guide
└── README.md          # This file
```

---

## Documentation

- **[DEV_GUIDE.md](DEV_GUIDE.md)** — Full developer guide with architecture, API reference, and extension instructions
- **[Main VibeScholar README](YOUR_GITHUB_LINK_HERE)** — Features, screenshots, demo project catalog

---

## License

CC BY-SA 4.0 — Same as the main VibeScholar project.

---

## Contact

<!-- TODO: Replace with your real contact information -->
- **Email:** [YOUR_EMAIL_HERE](mailto:YOUR_EMAIL_HERE)
- **GitHub:** [YOUR_GITHUB_LINK_HERE](YOUR_GITHUB_LINK_HERE)
