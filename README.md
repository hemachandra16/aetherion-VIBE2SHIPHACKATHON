# Aetherion — The Last-Minute Life Saver

**Vibe2Ship Hackathon | Coding Ninjas × Google for Developers**

Aetherion is an AI-powered emergency command center designed for crisis management. When you're facing an imminent missed deadline, a sudden schedule disruption, or an overwhelming workload, traditional "to-do list" apps fail because they rely on passive reminders. 

Aetherion intercepts you during these panic moments, utilizing a multi-agent AI pipeline to triage the crisis, generate a time-boxed, mathematically feasible recovery plan, and execute real-world actions to salvage the situation.

---

## 🌟 Key Features

- **Multi-Agent Reasoning Pipeline:** Instead of a single LLM call, Aetherion routes your crisis through four distinct AI agents: 
  - *Triage* (assesses urgency and asks clarifying questions)
  - *Planner* (generates recovery steps)
  - *Critic* (validates time constraints mathematically)
  - *Executor* (formats the output and triggers integrations)
- **Transparent Reasoning Trace:** Builds user trust by visually displaying the AI's thought process as it triages the problem.
- **Time-Boxed Burn Bar:** Generates plans specifically tailored to the exact minutes you have left, visually tracked via a UI Burn Bar (amber → ember).
- **Automated Crisis Mitigation (Integrations):** 
  - Automatically drafts context-aware emails (via Gmail API) to affected stakeholders (e.g., "My laptop crashed, presentation delayed by 15 mins").
  - Syncs recovery steps directly to your Google Calendar.
- **RAG-Grounded Planning:** Upload PDF/TXT notes so the plan is grounded in your actual content and study materials.

## 🛠️ Technologies & Stack

- **Frontend:** React (Vite) + Vanilla CSS (Glassmorphism & Dark UI)
- **Backend:** FastAPI (Python) + WebSockets
- **AI / LLM:** Google Gemini 3.5 Flash (Core Reasoning) + gemini-embedding-001 (RAG embeddings)
- **Authentication:** Google OAuth 2.0 (Firebase Auth)
- **APIs:** Google Calendar API, Gmail API
- **Deploy:** Google Cloud Run

## 🚀 Local Development

### Prerequisites
- Node.js 18+, Python 3.11+
- A Google Gemini API key
- Firebase project config (see `frontend/.env.example`)
- Google OAuth Client ID & Secret (for Calendar/Gmail integrations)

### Backend Setup
```bash
cd backend
cp .env.example .env   # fill in GEMINI_API_KEY and GOOGLE_CLIENT_*
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
cp .env.example .env   # fill in Firebase config values
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to `http://localhost:8000`.

## 🏗️ Architecture

See [architecture.md](architecture.md) for a deep dive into the multi-agent system design.
