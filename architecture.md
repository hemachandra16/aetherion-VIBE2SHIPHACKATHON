# Aetherion — Architecture

## System overview

```
                         ┌─────────────────────────┐
                         │   React + Tailwind UI    │
                         │  (Framer Motion micro-   │
                         │   interactions)           │
                         └────────────┬─────────────┘
                                      │ WebSocket (voice) / REST (text, actions)
                                      ▼
                         ┌─────────────────────────┐
                         │   Gemini Live API        │
                         │   native audio session   │
                         │  (barge-in, affective    │
                         │   dialog, function call)│
                         └────────────┬─────────────┘
                                      │ function calls
                                      ▼
            ┌──────────────────────────────────────────────────┐
            │                Agent Graph (LangGraph)            │
            │                                                    │
            │   Triage Agent → Planner Agent → Critic Agent      │
            │                        │                           │
            │                        ▼                           │
            │                 Action Executor                    │
            └──────────┬─────────────┬─────────────┬─────────────┘
                       │             │             │
                       ▼             ▼             ▼
              ┌──────────────┐ ┌───────────┐ ┌──────────────┐
              │ FAISS RAG     │ │ Google     │ │ Gmail API /   │
              │ (syllabus/    │ │ Calendar   │ │ Twilio SMS    │
              │ notes upload) │ │ API        │ │ (confirm-gated)│
              └──────────────┘ └───────────┘ └──────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │  Firebase (auth, user    │
                         │  profile, session state, │
                         │  conversation history)   │
                         └─────────────────────────┘

   Built in Google AI Studio → deployed to Cloud Run (single button deploy)
```

---

## 1. Voice/conversation layer — Gemini Live API native audio

Replaces the conventional STT → LLM → TTS chain with a single low-latency native-audio model over a persistent WebSocket session.

**Why this over a stitched pipeline:** lower latency, supports barge-in (user can interrupt mid-response — important when they're panicking and don't want to wait), affective dialog (model picks up urgency/stress in tone and adjusts pacing), and function calling is native to the session rather than a separate downstream step.

**Session responsibilities:**
- Receives raw audio (or text, for users who prefer typing)
- Streams back audio + transcript
- Calls backend functions directly mid-conversation: `start_triage()`, `get_plan_status()`, `confirm_send(action_id)`
- Proactive audio mode: stays silent during the user's own thinking/working time, speaks only when it has something actionable

**Fallback:** text-only mode for users who don't grant mic permission, or for the typed-input path — same agent graph underneath, just a REST call instead of a live session.

---

## 2. Agent graph (LangGraph orchestration)

Four nodes, each a distinct Gemini call with a narrow, specific job — not one mega-prompt doing everything.

### Triage Agent
- Input: raw user message/voice transcript
- Classifies: urgency tier, task type (exam / meeting / deadline / disruption), and whether critical info is missing
- If info is missing (no syllabus, no subject, no time given) → asks a targeted follow-up instead of passing an incomplete picture downstream
- Output: a structured `TriageResult { urgency, task_type, time_remaining, known_facts, missing_facts }`

### Planner Agent
- Input: `TriageResult` (+ RAG context if a syllabus/notes file was uploaded)
- Produces a minimum-viable, time-boxed plan: ordered steps, each with a duration and a cut-if-behind flag
- Explicitly drops nice-to-haves under time pressure rather than producing an idealized plan that won't fit

### Critic Agent
- Input: the Planner's draft plan
- Checks feasibility: do the durations actually sum to ≤ time remaining? Is step ordering sane (e.g. can't submit before reviewing)?
- If infeasible, sends it back to the Planner with specific feedback (one revision loop, not unbounded) — this loop is the most visible "agentic depth" moment and should be exposed in the UI as a short "revising plan…" beat, not hidden

### Action Executor
- Input: the approved plan
- Executes anything reversible automatically: writing time blocks to Google Calendar, updating in-app task state
- Anything irreversible (sending an email/SMS) is drafted and held for one-tap human confirmation before the real API call fires
- Re-invoked mid-execution by the live confidence-meter logic when the user falls significantly behind schedule

---

## 3. RAG layer (FAISS)

Used only when the user uploads a syllabus, notes, or past papers for a specific exam/task.

- Document → chunk → embed → FAISS index (in-memory is fine for hackathon scope, no need for Qdrant Cloud here)
- Planner Agent queries the index for "high-yield" content signals (repeated topics, explicitly weighted sections) instead of treating the whole document as flat context
- If nothing is uploaded, the Planner falls back to general triage heuristics rather than blocking

---

## 4. Tool integrations

| Tool | Use | Confirm-gated? |
|---|---|---|
| Google Calendar API | Write time blocks for the generated plan | No — reversible, can be undone/edited |
| Gmail API | Send a reschedule/extension request drafted by Disruption Mode | **Yes** — user taps send |
| Twilio SMS (optional) | Same as above, for a stronger live-demo moment | **Yes** |

The confirm gate is a deliberate design choice, not a missing feature: fully autonomous senders are the riskier pattern. Drafting + one-tap human confirmation on anything irreversible is the more mature agentic pattern and is worth stating explicitly in the pitch.

---

## 5. Data layer

- **Firebase Auth** — login
- **Firestore** — user profile (onboarding answers, rolling personalization signals), session/conversation history, generated plans
- No long-term ML personalization needed for the hackathon scope — store the signals, mention the roadmap, don't over-build this in the time available

---

## 6. Deployment

Build inside Google AI Studio (satisfies the mandatory core-tool requirement), one-click deploy to Cloud Run. Cloud Run hosts the same backend code (FastAPI-style routes are fine — Cloud Run runs any containerized app) that the Live API session and agent graph live in. Continue iterating in the Cloud Run source editor for anything AI Studio's own editor doesn't cover.

Submission's **Deployed Application Link** = the Cloud Run URL produced by this flow.

---

## 7. End-to-end walkthrough — "exam in 2 hours, haven't studied"

1. User opens Last-Minute Mode, speaks the situation (Live API session starts)
2. Triage Agent flags: urgency = critical, task_type = exam, missing_facts = [subject, syllabus]
3. Agent asks back: "Which subject, and do you have notes or a syllabus to upload?"
4. User uploads a notes PDF → RAG index built on the fly
5. Planner Agent produces a time-boxed plan grounded in the actual high-yield topics from the notes
6. Critic Agent checks the durations fit in 2 hours, sends back one revision (cuts a lower-priority topic)
7. Action Executor writes the blocks to the user's calendar
8. User starts working; confidence meter recalculates every few minutes against actual progress
9. If they fall behind, Planner is re-invoked to compress the remaining blocks — visible, not silent

## 8. End-to-end walkthrough — Disruption Mode

1. User logs a disruption ("family emergency, can't make my 3pm or finish tonight's deadline")
2. Triage Agent re-ranks today's remaining commitments by how unmissable they actually are
3. Planner drafts a short reschedule message for the affected manager/client/professor
4. User reviews the draft, taps confirm → Gmail API sends it for real
5. Action Executor reshuffles or clears the rest of the day's plan automatically
