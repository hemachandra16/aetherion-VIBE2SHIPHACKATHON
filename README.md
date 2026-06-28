# Aetherion — The Last-Minute Life Saver

**Vibe2Ship Hackathon | Coding Ninjas × Google for Developers | PS1**

An AI agent that doesn't just remind you about deadlines — it triages the moment you're already late, builds the minimum-viable plan to still make it, and acts on your behalf (with your sign-off) when things fall apart.

---

## Stack
- **Frontend:** React (Vite) + vanilla CSS design system
- **Backend:** FastAPI (Python)
- **AI:** Gemini 2.5 Flash (reasoning) + gemini-embedding-001 (RAG embeddings)
- **Auth:** Firebase (Google Sign-In), project `concrete-arcadia-r7krv`
- **Deploy:** Google Cloud Run

## Local development

### Prerequisites
- Node.js 18+, Python 3.11+
- A Gemini API key
- Firebase project config (see `frontend/.env.example`)

### Backend
```bash
cd backend
cp .env.example .env   # fill in GEMINI_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
cp .env.example .env   # fill in Firebase config values
npm install
npm run dev
```

Frontend runs on http://localhost:5173, proxies API calls to http://localhost:8000.

## Architecture
See [architecture.md](architecture.md) for the full system diagram.

**Agent pipeline:** Triage → Planner → Critic → Action Executor
- Triage classifies urgency and asks clarifying questions when info is missing
- Planner builds a minimum-viable, time-boxed plan (RAG-grounded if notes uploaded)
- Critic checks feasibility and runs one revision loop
- Executor stores the approved plan and tracks completion

## Features (Phases 0–4)
- Google Sign-In (Firebase Auth)
- Last-Minute Mode: chat → multi-agent plan → live confidence meter
- Burn bar: depleting timer visual (amber → ember as time runs out)
- RAG: upload PDF/TXT notes → plan grounded in your actual content
- Disruption Mode: log emergency → agent triages fallout → draft messages with human confirm gate
- Live confidence meter: recalculates from real plan state, not static

## Deployment
Cloud Run deployment instructions in `PROGRESS.md`.
