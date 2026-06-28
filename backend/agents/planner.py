"""
Planner Agent.
Input: TriageResult + optional RAG context.
Output: A time-boxed, ordered plan of steps from real Gemini output.
Never generates plans based on hardcoded example content.
"""
import json
import logging
from .gemini_client import call_gemini

logger = logging.getLogger("aetherion.planner")

PLANNER_SYSTEM_PROMPT = """You are the Planner Agent for Aetherion, an AI crisis planner.
Your job: given a triage result and optional context from the user's uploaded documents,
produce a minimum-viable, time-boxed action plan.

Rules:
1. The total duration of all non-cut steps must be LESS THAN OR EQUAL TO time_remaining_minutes.
2. Include a 5-10 minute buffer before the deadline — do not fill the entire time.
3. Mark lower-priority steps with "cut_if_behind": true — these are candidates for the Critic to remove.
4. Ground the plan in the RAG context if provided — mention specific topics from the user's documents.
5. If no RAG context is available, produce a sensible generic plan for the task type.
6. Ordering must be logical (e.g., review before practice, outline before writing).
7. Step titles must be specific to THIS user's task — never generic filler.

Output ONLY valid JSON:
{
  "plan_title": string,
  "total_minutes_budgeted": number,
  "time_remaining_minutes": number,
  "steps": [
    {
      "index": number,
      "title": string,
      "description": string,
      "duration_minutes": number,
      "cut_if_behind": boolean,
      "rag_grounded": boolean,
      "completed": false
    }
  ],
  "planner_notes": string
}"""


async def run_planner(triage_result: dict, rag_context: str = "") -> dict:
    """
    Generate a plan from the triage result and optional RAG context.
    Returns a plan dict with steps.
    """
    time_remaining = triage_result.get("time_remaining_minutes")
    task_type = triage_result.get("task_type", "unknown")
    subject = triage_result.get("subject_or_topic", "unspecified task")
    known_facts = triage_result.get("known_facts", [])

    rag_section = ""
    if rag_context.strip():
        rag_section = f"""
RELEVANT CONTENT FROM USER'S UPLOADED DOCUMENTS:
{rag_context}

Ground the plan steps in the above content where possible.
"""

    user_prompt = f"""Create a minimum-viable plan for this situation:

Task type: {task_type}
Subject/Topic: {subject}
Time remaining: {time_remaining} minutes
Known facts: {', '.join(known_facts) if known_facts else 'none beyond the above'}
{rag_section}

Produce a realistic, ordered, time-boxed plan. Total non-cut step durations must not exceed {time_remaining} minutes.
Include a ~5-10 minute buffer — do not plan to the last second.
Output the plan JSON."""

    logger.info(
        f"[planner] Planning for task_type={task_type}, "
        f"time={time_remaining}m, rag_context_len={len(rag_context)}"
    )

    raw = await call_gemini(
        system_prompt=PLANNER_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_mime_type="application/json",
    )

    try:
        plan = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"[planner] Failed to parse Gemini JSON: {e}\nRaw: {raw[:200]}")
        raise RuntimeError(f"Planner agent returned invalid JSON: {e}")

    if "steps" not in plan or not isinstance(plan["steps"], list):
        raise RuntimeError("Planner response missing 'steps' array")

    logger.info(
        f"[planner] Generated plan: '{plan.get('plan_title')}' "
        f"with {len(plan['steps'])} steps, {plan.get('total_minutes_budgeted')}m budgeted"
    )
    return plan
