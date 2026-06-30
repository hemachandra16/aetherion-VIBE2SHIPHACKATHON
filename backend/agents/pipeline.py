"""
Agent pipeline orchestrator.
Triage → (clarify?) → Planner → Critic → store plan.
Returns structured response the frontend can render directly.
No hardcoded scenarios anywhere — all values from user input or Gemini.
"""
import logging
import asyncio
from .triage import run_triage
from .planner import run_planner
from .critic import run_critic
from .rag import get_rag_context, get_rag_context_with_embeddings
from .session_store import (
    get_session,
    set_triage_result,
    set_plan,
    mark_step_completed,
    get_plan,
)
from .confidence import calculate_confidence

logger = logging.getLogger("aetherion.pipeline")


async def run_agent_pipeline(
    user_message: str,
    session_id: str,
    conversation_history: list[dict],
) -> dict:
    """
    Full Triage → Planner → Critic pipeline.

    Returns one of:
      { "type": "clarification", "question": str, "triage": dict }
      { "type": "plan", "plan": dict, "triage": dict, "was_revised": bool,
        "critique_notes": str, "confidence": dict, "rag_used": bool }
      { "type": "error", "error": True, "message": str }
    """
    session = get_session(session_id)

    # ── Step 1: Triage ───────────────────────────────────
    logger.info(f"[pipeline] Running triage for session={session_id}")
    triage_result = await run_triage(
        user_message=user_message,
        conversation_history=conversation_history,
    )
    set_triage_result(session_id, triage_result)

    # ── Step 2: Clarification needed? ───────────────────
    if triage_result.get("needs_clarification"):
        question = triage_result.get("clarifying_question") or "Could you give me more details?"
        logger.info(f"[pipeline] Clarification needed: {question}")
        return {
            "type": "clarification",
            "question": question,
            "triage": triage_result,
        }

    # ── Step 3: Validate we have minimum data ────────────
    time_remaining = triage_result.get("time_remaining_minutes")
    if not time_remaining or time_remaining <= 0:
        logger.warning("[pipeline] Triage said no clarification needed but time_remaining is null/zero")
        return {
            "type": "clarification",
            "question": "How much time do you have left before the deadline?",
            "triage": triage_result,
        }

    # ── Step 4: Get RAG context (cosine similarity on embeddings) ──
    rag_context = await get_rag_context_with_embeddings(session_id, query=user_message)
    if not rag_context:
        # Fallback: keyword overlap if no embeddings stored
        rag_context = get_rag_context(session_id, query=user_message)
    rag_used = bool(rag_context.strip())
    logger.info(f"[pipeline] RAG context: {'yes' if rag_used else 'none'} for session={session_id}")

    # ── Step 5: Plan ─────────────────────────────────────
    logger.info(f"[pipeline] Running planner for session={session_id}")
    await asyncio.sleep(2.0)  # Pace request to avoid 429 limits
    plan = await run_planner(triage_result=triage_result, rag_context=rag_context)

    # ── Step 6: Critic ───────────────────────────────────
    logger.info(f"[pipeline] Running critic for session={session_id}")
    await asyncio.sleep(2.0)  # Pace request to avoid 429 limits
    critic_result = await run_critic(
        plan=plan,
        time_remaining_minutes=int(time_remaining),
    )
    final_plan = critic_result["final_plan"]

    # Ensure completed=False on all steps (critic may omit it)
    for step in final_plan.get("steps", []):
        step.setdefault("completed", False)
        step.setdefault("completed_at", None)

    # ── Step 7: Store approved plan ──────────────────────
    set_plan(session_id, final_plan.get("steps", []))
    final_plan["session_id"] = session_id

    # ── Step 8: Initial confidence ───────────────────────
    confidence = calculate_confidence(session_id)

    logger.info(
        f"[pipeline] Complete for session={session_id}: "
        f"{len(final_plan.get('steps', []))} steps, "
        f"revised={critic_result['was_revised']}, "
        f"confidence={confidence.get('score')}%"
    )

    return {
        "type": "plan",
        "plan": final_plan,
        "triage": triage_result,
        "was_revised": critic_result["was_revised"],
        "critique_notes": critic_result["critique_notes"],
        "confidence": confidence,
        "rag_used": rag_used,
    }


def update_step_status(session_id: str, step_index: int, completed: bool) -> dict:
    """Mark a step done and return updated confidence."""
    if completed:
        mark_step_completed(session_id, step_index)
    confidence = calculate_confidence(session_id)
    plan = get_plan(session_id)
    return {
        "step_index": step_index,
        "completed": completed,
        "confidence": confidence,
        "plan": plan,
    }
