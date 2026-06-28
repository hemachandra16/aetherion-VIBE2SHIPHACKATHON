# Aetherion — The Last-Minute Life Saver

**One-liner:** An AI agent that doesn't just remind you about deadlines — it triages the moment you're already late, builds the minimum-viable plan to still make it, and acts on your behalf (with your sign-off) when things fall apart.

**Track:** Vibe2Ship PS1 — The Last-Minute Life Saver
**Built with:** Google AI Studio (core tool) → deployed on Cloud Run

---

## The problem, as given

Students, professionals, and entrepreneurs miss deadlines, assignments, meetings, bill payments, interviews, and commitments — not because they don't have reminder apps, but because passive reminders are easy to ignore and don't help anyone actually finish the work.

## What everyone else in this space already does

Motion, Reclaim, Sunsama, Akiflow, Notion AI, Todoist — every major AI productivity tool on the market in 2026 is built around **ongoing, steady-state planning**: auto-scheduling your week, protecting focus blocks, rebalancing your calendar as meetings shift. They're all "manage my life going forward" tools.

**None of them are built for the acute moment** — exam in 2 hours and you haven't opened a book, flight tomorrow and the bag isn't packed, deck due in 20 minutes and it's half-finished. That gap is the literal name of this problem statement, and it's where Aetherion lives.

## The core idea: three modes, one agent

### 1. Last-Minute Mode (the headline feature)
User hits a panic entry point (button or voice: "exam in 2 hours, haven't studied") and the agent:
- Classifies urgency and remaining time
- Asks for missing critical context instead of guessing (which subject, syllabus/notes if any, what's actually graded) — this is a deliberate agentic choice, not a gap
- Builds the *minimum viable* path to a good outcome, not a generic to-do list
- Allocates remaining time block by block
- Tracks progress live and **replans** as the user falls behind or catches up

### 2. Disruption Mode
Life interrupts the plan itself — sudden illness, family emergency, a flat tyre — and now everything else on the calendar is at risk. The agent doesn't try to handle the emergency; it triages the **fallout**:
- Surfaces what's now genuinely at risk vs flexible
- Drafts (never auto-sends) reschedule messages to the professor/manager/client involved
- One-tap human confirmation before anything irreversible goes out (Gmail API send, optional SMS via Twilio for a stronger live demo)
- Reshuffles the rest of the day automatically once the disruption is logged

### 3. Live confidence meter
A continuously recalculated "% chance you make it in time" that updates as the user works through the plan — falls behind, the agent compresses or cuts non-essentials; catches up, the meter reflects it. Cheap to build, strong visually, and a concrete expression of *ongoing* agentic reasoning rather than a one-shot plan.

## Why this is hard to copy in 6 days

The obvious build for this brief is: one Gemini call → text plan → done. Aetherion's differentiation isn't a bigger feature list, it's three architectural choices most solo builders won't have time to discover or implement:

1. **Gemini Live API native audio** instead of a stitched STT→LLM→TTS pipeline — single low-latency model, supports mid-response interruption (barge-in), and reads stress/urgency in voice tone (affective dialog). Directly fits a panic-mode product and is a genuine "Google technology" flex.
2. **A visible multi-agent reasoning trace** (Triage → Planner → Critic → Executor) instead of a black-box chat reply — judges see the agent reason and self-correct, not just answer.
3. **Real actions behind a human-confirm gate** (calendar writes, drafted-then-sent emails) instead of suggestions only — the actual line between an assistant and an agent.

## Cold start & missing information (the two open design questions)

- **First-time user, no history:** Last-Minute Mode doesn't need history to be useful — it works from the current input alone. A short 3–4 question onboarding gives sensible defaults for everything else; personalization sharpens over real usage, not day one.
- **"I have an exam" with no syllabus given:** the agent asks back for specifics (subject, weighted topics, uploaded notes) rather than generating a fake confident plan. If notes/syllabus are uploaded, ground the plan in them via retrieval (FAISS) instead of generic advice. If the user genuinely has nothing more to give, fall back to a sensible generic triage heuristic rather than failing.

## How this maps to the evaluation matrix

| Criteria | Weight | How Aetherion hits it |
|---|---|---|
| Problem Solving & Impact | 20% | Solves the acute moment the brief is literally named after, not generic scheduling |
| Agentic Depth | 20% | Visible multi-agent loop, live replanning, real actions behind confirm gate |
| Innovation & Creativity | 20% | Last-Minute Mode + Disruption Mode framing, confidence meter |
| Usage of Google Technologies | 15% | Gemini Live API native audio, function calling, Google Calendar/Gmail API, AI Studio → Cloud Run deploy |
| Product Experience & Design | 10% | Deliberate visual identity (see UI sketch), not a default AI-generated look |
| Technical Implementation | 10% | Multi-agent orchestration, RAG grounding, real tool calls |
| Completeness & Usability | 5% | Scoped tightly enough to actually finish solo in 6 days |
