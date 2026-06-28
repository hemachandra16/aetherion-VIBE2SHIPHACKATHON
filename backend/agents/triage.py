"""
Triage Agent.
Classifies urgency, task type, and whether critical info is missing.
If info is missing → returns a clarifying question, does NOT guess or default.
Output is always a TriageResult dict derived from real Gemini output.
"""
import json
import logging
from .gemini_client import call_gemini

logger = logging.getLogger("aetherion.triage")

TRIAGE_SYSTEM_PROMPT = """You are the Triage Agent for Aetherion, an AI crisis planner.
Your job: analyze the user's message and conversation history, then output a JSON TriageResult.

Rules:
1. Never invent or assume values for time_remaining, subject, or task_type — if not stated clearly, mark them as null and set needs_clarification=true.
2. If needs_clarification is true, write a concise clarifying_question that asks for ONLY the most critical missing piece of information (one question, not a list).
3. If needs_clarification is false, all fields required to build a plan must be non-null.
4. urgency tiers: "critical" (minutes to hours), "high" (today), "medium" (tomorrow/this week), "low" (later).
5. task_type options: "exam", "assignment", "meeting", "presentation", "work_deadline", "personal", "disruption", "other".

Output ONLY valid JSON matching this schema exactly:
{
  "needs_clarification": boolean,
  "clarifying_question": string | null,
  "urgency": "critical" | "high" | "medium" | "low" | null,
  "task_type": string | null,
  "time_remaining_minutes": number | null,
  "subject_or_topic": string | null,
  "known_facts": [string],
  "missing_facts": [string],
  "mode": "last_minute" | "disruption" | "general"
}"""


async def run_triage(user_message: str, conversation_history: list[dict]) -> dict:
    """
    Run the Triage Agent on the user's message.
    Returns a TriageResult dict.
    If needs_clarification=True, the caller should return the clarifying_question to the user
    and NOT proceed to the Planner.
    """
    # Build conversation context for triage
    history_text = ""
    if conversation_history:
        history_lines = []
        for turn in conversation_history[-6:]:  # last 6 turns max
            role = turn.get("role", "user")
            content = turn.get("content", "")
            history_lines.append(f"{role.upper()}: {content}")
        history_text = "\n".join(history_lines) + "\n"

    user_prompt = f"""Conversation so far:
{history_text}
CURRENT USER MESSAGE: {user_message}

Analyze and return the TriageResult JSON."""

    logger.info(f"[triage] Running triage on: {user_message[:80]}...")

    raw = await call_gemini(
        system_prompt=TRIAGE_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_mime_type="application/json",
    )

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"[triage] Failed to parse Gemini JSON: {e}\nRaw: {raw[:200]}")
        raise RuntimeError(f"Triage agent returned invalid JSON: {e}")

    # Validate required fields
    required = ["needs_clarification", "urgency", "task_type", "mode"]
    for field in required:
        if field not in result:
            raise RuntimeError(f"Triage result missing required field: '{field}'")

    logger.info(
        f"[triage] Result: needs_clarification={result['needs_clarification']}, "
        f"urgency={result.get('urgency')}, task_type={result.get('task_type')}, "
        f"time_remaining_minutes={result.get('time_remaining_minutes')}"
    )
    return result
