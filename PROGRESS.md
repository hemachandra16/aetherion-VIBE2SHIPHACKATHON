# Aetherion — Progress Log

**Deadline:** 2026-06-30 23:59 IST
**Started:** 2026-06-28 ~13:15 IST
**Updated:** 2026-06-28 ~15:45 IST
**Hours remaining:** ~56

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

## Phase 6 — Disruption Mode + Calendar/Gmail (stretch)
- [x] Disruption Mode UI screen (chat + reshuffled plan + draft email modal)
- [x] Human confirm gate on send (modal, not auto-send)
- [ ] Actual Gmail API — needs OAuth setup (flagged as stretch)

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
