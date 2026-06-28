"""
In-memory session store.
Holds plan state, RAG index, and timing info per session_id.
All data must originate from real user input or real Gemini output — never seeded with examples.
"""
import time
import logging
from typing import Optional

logger = logging.getLogger("aetherion.session")

# { session_id: SessionData }
_sessions: dict[str, dict] = {}


def get_session(session_id: str) -> dict:
    """Get or create a blank session."""
    if session_id not in _sessions:
        _sessions[session_id] = {
            "session_id": session_id,
            "created_at": time.time(),
            "triage_result": None,
            "plan": None,          # list of PlanStep dicts
            "plan_started_at": None,
            "rag_chunks": [],      # list of { text, embedding }
            "rag_filename": None,
            "conversation_history": [],
            "mode": None,          # "last_minute" | "disruption"
        }
        logger.info(f"[session] Created new session: {session_id}")
    return _sessions[session_id]


def set_triage_result(session_id: str, triage_result: dict):
    s = get_session(session_id)
    s["triage_result"] = triage_result
    logger.info(f"[session] Triage result stored for {session_id}")


def set_plan(session_id: str, plan: list[dict]):
    """Store an approved plan and record the start time."""
    s = get_session(session_id)
    s["plan"] = plan
    s["plan_started_at"] = time.time()
    logger.info(f"[session] Plan stored ({len(plan)} steps) for {session_id}")


def get_plan(session_id: str) -> Optional[list[dict]]:
    return get_session(session_id).get("plan")


def mark_step_completed(session_id: str, step_index: int):
    s = get_session(session_id)
    plan = s.get("plan")
    if not plan:
        raise ValueError(f"No plan found for session {session_id}")
    if step_index < 0 or step_index >= len(plan):
        raise IndexError(f"Step index {step_index} out of range for plan with {len(plan)} steps")
    plan[step_index]["completed"] = True
    plan[step_index]["completed_at"] = time.time()
    logger.info(f"[session] Step {step_index} marked complete for {session_id}")


def store_rag_chunks(session_id: str, chunks: list[dict], filename: str):
    s = get_session(session_id)
    s["rag_chunks"] = chunks
    s["rag_filename"] = filename
    logger.info(f"[session] Stored {len(chunks)} RAG chunks from '{filename}' for {session_id}")


def get_rag_chunks(session_id: str) -> list[dict]:
    return get_session(session_id).get("rag_chunks", [])


def clear_session(session_id: str):
    if session_id in _sessions:
        del _sessions[session_id]
        logger.info(f"[session] Cleared session {session_id}")
