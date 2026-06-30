# Aetherion — Progress Log

**Deadline:** 2026-06-30 23:59 IST
**Started:** 2026-06-28 ~13:15 IST
**Updated:** 2026-06-30 20:22 IST
**Hours remaining:** ~4

---

## Phase 0 — Scaffold ✅ VERIFIED
- [x] React (Vite) frontend — build verified: 305ms, 0 errors, 43 modules
- [x] FastAPI backend — all imports clean, server starts cleanly
- [x] Firebase Auth (Google Sign-In) wired — both .env files populated
- [x] Basic routing (Home, Last-Minute Mode, Disruption Mode)
- [x] API client layer (frontend/src/api.js)
- [x] Backend endpoints: /api/health, /api/chat, /api/upload, /api/step/complete, /api/confidence
- [x] Dockerfiles for deployment

## Phase 1 — Design System ✅ VERIFIED
- [x] CSS custom properties (ink/charcoal/amber/ember/sage palette)
- [x] Typography (Barlow Condensed / Public Sans / JetBrains Mono)
- [x] Reusable components: BurnBar, PanicButton, ConfidenceMeter, ReasoningTrace, PlanView, FileUpload
- [x] Chat bubbles, modal overlay, loading states, error banners

## Phase 2 — Multi-Agent Pipeline ✅ LIVE VERIFIED
Real test output 2026-06-28 15:12 IST (gemini-2.5-flash, temp sub):
- TEST 1 (biology exam, 90m): → plan "Emergency Biology Exam Prep: 90 Minutes to Impact" (5 steps)
- TEST 2 (presentation, 3h): → plan "Client Presentation Completion & Practice" (9 steps)
- TEST 3 (interview, no time): → clarification "When is the interview?" ✅
- CROSS-CHECK: Plans are genuinely different ✅ No hardcoding detected ✅
- [x] Triage Agent — correctly detects missing time and asks
- [x] Planner Agent — produces domain-specific plans
- [x] Critic Agent — reviews feasibility (logged in server output)
- [x] Model: TEMP gemini-2.5-flash (gemini-3.5-flash 503-ing, user approved swap)

## Phase 3 — RAG / Syllabus Grounding ✅ LIVE VERIFIED
Real test output 2026-06-28 15:46 IST:
- organic_chemistry_notes.txt → 5 chunks ✅
- project_management_guide.txt → 4 chunks ✅
- Chemistry query → plan "Chemistry Exam Prep: Organic Reactions & Spectroscopy" RAG=True ✅
- PM query → plan "Project Status Report & Risk Register Completion Plan" RAG=True ✅
- Plans are different across sessions ✅ No cross-contamination ✅
- [x] Upgraded pipeline to use cosine-similarity embedding retrieval (was keyword fallback)
- [x] Two-file isolation verified

## Phase 4 — Live Confidence Meter ✅ VERIFIED
- [x] Real calculation from plan state (unit test passed earlier)
- [x] Updates on step completion via /api/step/complete
- [x] Frontend polls every 60s

## Phase 5 — Voice (stretch)
- [ ] Not started — deprioritized given time budget; core is solid

## Phase 6 — Disruption Mode + Calendar/Gmail (stretch) ✅ VERIFIED
- [x] Disruption Mode UI screen (chat + reshuffled plan + draft email modal)
- [x] Human confirm gate on send (modal, not auto-send)
- [x] Actual Gmail API — real OAuth setup completed, `sendRealEmail` integrated
- [x] Actual Calendar API — writes events to real Google Calendar on commitment add

## Phase 7 — Polish
- [ ] Not started — next priority after Phase 8 setup

## Phase 8 — Submission
- [ ] GitHub push (public repo)
- [ ] Cloud Run deploy
- [ ] Google Doc draft

---

## Activity Log

### 2026-06-28 ~13:15–14:09 IST
- Scaffolded full stack, built all components and agents

### 2026-06-28 ~15:00–15:09 IST (post-restart)
- Verified all files intact, credentials in place
- gemini-3.5-flash returning 503 (traffic spike)
- Diagnosed: 3.5-flash=503, 3.1-pro-preview=429 (quota), 2.5-flash=OK, 3.1-flash-lite=OK
- User approved temp swap to gemini-2.5-flash

### 2026-06-28 ~15:09–15:46 IST
- Fixed gemini_client.py: async sleep, 5 retries, 5s base backoff
- Fixed test_anti_hardcode.py: 300s timeout, Windows CP1252 encoding fix
- Upgraded pipeline.py: cosine-similarity RAG instead of keyword fallback
- PHASE 2 LIVE VERIFIED: 3/3 anti-hardcode tests PASS
- PHASE 3 LIVE VERIFIED: RAG with 2 files, different sessions, different plans
- Created test_rag_verify.py

### 2026-06-28 ~15:25-15:55 IST — Full audit + 9-bug fix sweep
**CRITICAL FIX: Firebase auth/unauthorized-domain**
- Added dev bypass mode (LoginScreen + AuthContext) so app is testable without Firebase console access
- Shows clear error message with instructions to add localhost to Firebase console
- Dev mode persisted in localStorage

**HIGH: Session store hardened**
- Added TTL expiry (6 hours) with automatic cleanup
- Max 100 concurrent sessions with LRU eviction
- Max 5 files per session, max 200 chunks per session
- Embeddings stored as numpy float32 arrays (~3x more compact than Python lists)
- Memory estimation on every RAG store operation

**HIGH: File upload limits enforced**
- 10MB max file size (both client-side and server-side validation)
- File count limit enforced before reading file data
- Uploaded files list returned in API response + displayed in UI
- Remaining files counter shown to user

**HIGH: RAG chunks now APPEND, not overwrite**
- Second file upload adds to existing RAG index, not replaces it
- Oldest chunks trimmed if over limit

**MEDIUM: PlanView cut_if_behind fix**
- Steps with `cut_if_behind: true` no longer shown as crossed out
- Only `cut: true` (set by Critic) marks a step as cut
- Added hint text for skippable steps

**MEDIUM: ReasoningTrace race condition fix**
- Interval stored in ref, cleaned up on unmount
- stopReasoning immediately completes all agents

**Verified end-to-end in browser:**
- Login → dev mode bypass → Home screen → Last-Minute screen
- All screens render correctly, all components present
- Frontend build: 269ms, 0 errors
- Backend imports: all clean, limits confirmed
- Health endpoint: session stats working

### NEXT: Firebase Console auth fix + Phase 8 deployment

### 2026-06-28 ~20:15-01:35 IST — UI Overhaul + Features + Error Polish

**MAJOR: UI Overhaul (command-center aesthetic)**
- Full-width dashboard layout (removed 480px mobile constraint)
- Persistent top navbar with HOME / CRISIS MODE / RESHUFFLE tabs
- Version badge (v0.5-beta) + model status indicator (Gemini 2.5 Flash)
- Hero panic banner: full-width gradient + description text + icon
- Scheduled Duties section with empty state
- Disruption CTA card with hover effects
- Status bar with greeting + live clock
- Responsive breakpoints for mobile
- Loading spinner animation

**FEAT: Calendar Commitments API**
- POST /api/commitments — add calendar events per session
- GET /api/commitments/{session_id} — list commitments
- Commitments stored in session store with auto status (SOON/ON TRACK/URGENT)

**FEAT: Gmail Email Draft API**
- POST /api/email/draft — Gemini-powered email draft generation
- DisruptionScreen: real AI email drafts (not static alert)
- Editable draft textarea + copy-to-clipboard

**FIX: File upload limit increased to 100MB** (both client + server)

**FIX: Error messages cleaned up**
- Backend: detect 429/503 errors, show human-readable messages
- Frontend: truncate long errors to 200 chars, detect rate limits
- Agent chat messages explain errors in plain English

**Firebase Status:** AI Studio Starter tier blocks domain management via Console.
Dev bypass mode works for all testing. Need project owner to add localhost.

**Verified end-to-end in browser (5 commits, all passing):**
- Login → dev bypass → Home → Crisis Mode → Reshuffle: all tabs work
- Build: 265ms, 0 errors, 43 modules
- Known: Gemini free-tier rate limit (20 req/day) blocks live AI testing

### NEXT: Phase 8 — GitHub push + Cloud Run deploy + submission doc

### 2026-06-30 19:51 IST — Step 1 verification by OpenCode
- Read PROGRESS.md and DECISIONS.md fully before touching code.
- `git status --short`: dirty worktree already present with multiple modified/untracked app files, including partially-added voice files.
- Frontend build verified: `npm run build` passed with Vite 8.1.0, 44 modules transformed, built in 341ms.
- Backend import verified: `python -c "import fastapi, uvicorn; import main; print('backend import ok')"` passed under Python 3.14.3.
- Local split runtime verified: started FastAPI on `127.0.0.1:8000` and Vite on `127.0.0.1:5173`.
- `/api/health` returned 200 with `status=ok`, `gemini_key_set=true`, and zero active sessions.
- Vite app shell returned 200 and contained `<div id="root"></div>`.
- Observed issue: backend root `/` returns 404 in local backend-only mode because `backend/dist` does not exist locally. This should be OK for Cloud Run because the root Dockerfile copies frontend `dist` into backend `dist`.
- Observed blocker/scope mismatch: Gemini Live/voice is wired into backend (`agents.voice` router) and frontend (`VoiceButton` on Crisis and Reshuffle screens), despite the cut-scope instruction. Next step is disabling it without refactoring core flows.

### 2026-06-30 19:53 IST — Step 2 scoped blocker fix
- Disabled the out-of-scope Gemini Live/voice feature by removing the backend voice router wiring and removing `VoiceButton` imports/buttons plus voice websocket listeners from Crisis Mode and Reshuffle screens.
- Left `backend/agents/voice.py` and `frontend/src/components/VoiceButton.jsx` unreferenced rather than deleting files, to minimize churn under deadline pressure.
- Frontend rebuild verified after fix: `npm run build` passed, 43 modules transformed, built in 356ms.
- Backend import verified after fix: `python -c "import main; print('backend import ok')"` passed.
- Local split runtime re-verified: `/api/health` returned 200 and Vite app shell returned 200 with root div present.

### 2026-06-30 20:04 IST — Step 3 local E2E verification
- Direct backend E2E: started FastAPI locally and posted a real Crisis Mode request to `/api/chat` with session `e2e-local-20260630`.
- API result: `type=plan`, `rag_used=false`, `triage.time_remaining_minutes=120`, `steps=5`, `confidence.score=85`, `confidence.label=On track`, first step `Review Core Sorting Algorithms | 20m`.
- Confidence endpoint check: `/api/confidence/e2e-local-20260630` returned `score=85`, `total=5`, `completed=0`, `trend=stable`.
- Browser E2E: installed Playwright browser tooling locally, started FastAPI + Vite, clicked `Continue in dev mode`, navigated to Crisis Mode, submitted a real 90-minute data-structures exam prompt, and waited for rendered plan output.
- Browser result: URL `http://127.0.0.1:5173/last-minute`, reasoning trace displayed `Agent reasoning complete` for Triage/Planner/Critic/Executor, burn bar displayed `Time remaining 1h 30m`, confidence displayed `85% ON TRACK`, plan rendered 5 steps, first step was sorting-algorithm review, and `BROWSER_ERRORS=[]`.

### 2026-06-30 20:22 IST — User-requested quick checks in browser
- Check 1 Model: `backend/agents/gemini_client.py` had been set to `gemini-3.5-flash` while the UI header still said `Gemini 2.5 Flash`. A real 3.5 API check returned a pipeline error (`Planner agent returned invalid JSON`), so per fallback rule the reasoning model was reverted to `gemini-2.5-flash` and the existing header label is now accurate.
- Browser model verification after fallback: Chromium/Playwright rendered `MODEL_LABEL=Gemini 2.5 Flash`, submitted a real 45-minute statistics quiz prompt, and received `MODEL_BROWSER_RESULT=PLAN`, `PLAN_STEP_COUNT=5`, `CONFIDENCE=85% ON TRACK`, `BURN=Time remaining 45m`, first step `Review Probability Distribution Concepts & Formulas`.
- Check 2 Mic button: Chromium/Playwright verified `CRISIS_VOICE_BUTTONS=0` and `RECOVER_VOICE_BUTTONS=0`; voice UI is removed from active screens.
- Check 3 Chat persistence: code uses per-page-load React state (`useState([])` and `makeSessionId()`), not Firestore/localStorage persistence. Browser refresh test confirmed `USER_BUBBLES_AFTER_REFRESH=0`, so do not refresh mid-demo.
- Post-check verification: `npm run build` passed in 298ms and backend import printed `model=gemini-2.5-flash`.

### 2026-06-30 20:40 IST — Step 4 Cloud Run deployment COMPLETE
- `gcloud` installed via winget (v574.0.0), authenticated as `hemachandra.agni@gmail.com`, project set to `aethiron-90a06`.
- Fixed `deploy.sh` default project from `concrete-arcadia-r7krv` to `aethiron-90a06` (matching actual Firebase project).
- Enabled Cloud Run, Cloud Build, Artifact Registry, Container Registry APIs.
- Cloud Build submitted via `cloudbuild.yaml` with Firebase build args from `frontend/.env`: build completed in 1m16s, image `gcr.io/aethiron-90a06/aetherion`.
- Cloud Run deployed: `gcloud run deploy aetherion --image gcr.io/aethiron-90a06/aetherion --region asia-south1 --allow-unauthenticated --port 8080 --memory 512Mi --cpu 1 --min-instances 0 --max-instances 5 --timeout 300`.
- Live URL: `https://aetherion-308059826502.asia-south1.run.app`
- Live URL verified: `/api/health` returned 200 (`status=ok`, `gemini_key_set=true`), frontend SPA shell returned 200 with root div.
- BLOCKER for demo: Firebase Auth requires `aetherion-308059826502.asia-south1.run.app` to be added to Firebase Console → Authentication → Settings → Authorized domains. User must do this manually.
