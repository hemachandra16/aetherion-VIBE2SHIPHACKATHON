# Aetherion — Technical Decisions Log

## Decision 1: Stack Choice — React (Vite) + Python (FastAPI)
**Date:** 2026-06-28 ~13:15 IST

**Choice:** React frontend via Vite + FastAPI backend in Python

**Rationale:**
- architecture.md suggests React + Tailwind, but the master prompt warns against Tailwind (use vanilla CSS) and against copying architecture.md blindly. Using **React via Vite** for the frontend — fast HMR, simple setup, no Next.js overhead needed for what is essentially an SPA.
- **Vanilla CSS** for styling (per master prompt web_application_development guidelines — no Tailwind unless explicitly requested). The design system from ui-sketch.html will be rebuilt as proper CSS custom properties and component styles.
- **FastAPI** backend as strongly recommended — avoids the ESM/CJS PDF parsing issue that killed the previous Node attempt. Python ecosystem for PDF (pypdf/pdfplumber), embeddings, and agent orchestration is much more stable.
- **No LangGraph** — the architecture.md mentions it, but for a 4-agent linear pipeline (Triage → Planner → Critic → Executor), a simple sequential orchestrator in plain Python is less risky and faster to debug than adding a LangGraph dependency. Each agent is just a Gemini API call with a specific system prompt and structured output parsing. Logging DECISIONS.md.

## Decision 2: In-memory vector store instead of FAISS
**Date:** 2026-06-28 ~13:15 IST

**Choice:** NumPy cosine similarity on embeddings arrays, not FAISS

**Rationale:**
- For hackathon scope, uploaded docs will be small (a few pages). FAISS adds a C dependency that can cause build issues in Docker/Cloud Run. Simple NumPy cosine similarity on `gemini-embedding-001` vectors is sufficient and has zero install risk.

## Decision 3: Firebase project reuse
**Date:** 2026-06-28 ~13:15 IST

**Choice:** Reuse `concrete-arcadia-r7krv` Firebase project

**Rationale:** Per master prompt — Firestore rules already configured. Will verify rules before building on them.

## Decision 5: Model lock correction
**Date:** 2026-06-28 ~14:10 IST

**Choice:** Use `gemini-3.5-flash` for all reasoning agents, `gemini-embedding-001` for embeddings.

**Rationale:** Master prompt explicitly specifies these models. I initially wrote `gemini-2.5-flash` by mistake — corrected to `gemini-3.5-flash`. If the model name errors at runtime, I will stop and ask the user rather than substituting a different model.

## Decision 4: Font stack
**Date:** 2026-06-28 ~13:15 IST

**Choice:**
- Display: Barlow Condensed (condensed, high-impact headers)
- Body: Public Sans (humanist sans-serif, NOT Inter)
- Mono: JetBrains Mono (timer/numeric displays)

**Rationale:** Extracted from ui-sketch.html design language. Public Sans specifically chosen as the humanist body face per master prompt instruction.

## Decision 6: Temporary reasoning model swap — gemini-2.5-flash (revert when 3.5-flash recovers)
**Date:** 2026-06-28 ~15:09 IST

**Choice:** Use `gemini-2.5-flash` temporarily instead of `gemini-3.5-flash`

**Diagnosis (actual API probe, 2026-06-28 ~15:09 IST):**
- `gemini-3.5-flash` → 503 UNAVAILABLE (high demand / traffic spike)
- `gemini-3.1-pro-preview` → 429 RESOURCE_EXHAUSTED (no free quota on this key for preview-Pro)
- `gemini-3.1-flash-lite` → OK 0.7s
- `gemini-2.5-flash` → OK 1.1s

**Rationale:** User explicitly approved temporary substitution to unblock testing. `gemini-2.5-flash` chosen over `gemini-3.1-flash-lite` because it's a closer capability match to 3.5-flash (same generation tier). Will revert to `gemini-3.5-flash` once the 503s clear — the model lock comment is preserved in gemini_client.py.
