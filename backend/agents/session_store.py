"""
In-memory session store.
Holds plan state, RAG index, and timing info per session_id.
All data must originate from real user input or real Gemini output — never seeded with examples.

Memory management:
- Max 100 concurrent sessions
- Sessions expire after 6 hours of inactivity (TTL)
- RAG chunks per session limited to MAX_RAG_CHUNKS
- Embeddings stored as compact numpy arrays
- Total RAG storage per session capped at ~50MB
"""
import time
import logging
import sys
from typing import Optional

import numpy as np

logger = logging.getLogger("aetherion.session")

# ── Limits ────────────────────────────────────────────────
MAX_SESSIONS = 100
SESSION_TTL_SECONDS = 6 * 3600  # 6 hours
MAX_RAG_CHUNKS_PER_SESSION = 200  # ~200 chunks ≈ 80,000 chars ≈ a 40-page doc
MAX_FILES_PER_SESSION = 5
MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB

# { session_id: SessionData }
_sessions: dict[str, dict] = {}


def _estimate_session_memory(session: dict) -> int:
    """Rough estimate of session memory in bytes."""
    total = sys.getsizeof(session)
    chunks = session.get("rag_chunks", [])
    for chunk in chunks:
        total += sys.getsizeof(chunk.get("text", ""))
        emb = chunk.get("embedding")
        if emb is not None:
            if isinstance(emb, np.ndarray):
                total += emb.nbytes
            elif isinstance(emb, list):
                total += len(emb) * 4  # float32 ≈ 4 bytes each
    plan = session.get("plan")
    if plan:
        total += sys.getsizeof(str(plan))
    return total


def _evict_expired():
    """Remove sessions that haven't been touched in TTL_SECONDS."""
    now = time.time()
    expired = [
        sid for sid, s in _sessions.items()
        if now - s.get("last_accessed", s.get("created_at", 0)) > SESSION_TTL_SECONDS
    ]
    for sid in expired:
        del _sessions[sid]
        logger.info(f"[session] Evicted expired session: {sid}")
    return len(expired)


def _evict_oldest_if_over_limit():
    """If over MAX_SESSIONS, evict the oldest (least recently accessed)."""
    if len(_sessions) <= MAX_SESSIONS:
        return
    # Sort by last_accessed, evict oldest
    sorted_sessions = sorted(
        _sessions.items(),
        key=lambda kv: kv[1].get("last_accessed", kv[1].get("created_at", 0))
    )
    to_evict = len(_sessions) - MAX_SESSIONS
    for sid, _ in sorted_sessions[:to_evict]:
        del _sessions[sid]
        logger.info(f"[session] Evicted oldest session (over limit): {sid}")


def get_session(session_id: str) -> dict:
    """Get or create a blank session. Touches last_accessed."""
    # Periodic cleanup
    if len(_sessions) > MAX_SESSIONS // 2:
        _evict_expired()
        _evict_oldest_if_over_limit()

    if session_id not in _sessions:
        _sessions[session_id] = {
            "session_id": session_id,
            "created_at": time.time(),
            "last_accessed": time.time(),
            "triage_result": None,
            "plan": None,          # list of PlanStep dicts
            "plan_started_at": None,
            "rag_chunks": [],      # list of { text, embedding (np.ndarray) }
            "rag_files": [],       # list of { filename, chunk_count, char_count }
            "conversation_history": [],
            "mode": None,          # "last_minute" | "disruption"
        }
        logger.info(f"[session] Created new session: {session_id}")
    else:
        _sessions[session_id]["last_accessed"] = time.time()
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
    """
    APPEND chunks to the session's RAG store (not replace).
    Enforces per-session chunk limit and file count limit.
    Converts embedding lists to numpy arrays for memory efficiency.
    """
    s = get_session(session_id)

    # Check file count limit
    existing_files = s.get("rag_files", [])
    if len(existing_files) >= MAX_FILES_PER_SESSION:
        raise ValueError(
            f"Maximum {MAX_FILES_PER_SESSION} files per session. "
            f"Already uploaded: {', '.join(f['filename'] for f in existing_files)}"
        )

    # Convert embeddings to numpy arrays for compact storage
    for chunk in chunks:
        emb = chunk.get("embedding")
        if emb is not None and not isinstance(emb, np.ndarray):
            chunk["embedding"] = np.array(emb, dtype=np.float32)

    # Enforce per-session chunk limit — keep newest chunks
    existing_chunks = s.get("rag_chunks", [])
    combined = existing_chunks + chunks
    if len(combined) > MAX_RAG_CHUNKS_PER_SESSION:
        overflow = len(combined) - MAX_RAG_CHUNKS_PER_SESSION
        logger.warning(
            f"[session] Chunk limit hit for {session_id}: "
            f"trimming {overflow} oldest chunks (limit={MAX_RAG_CHUNKS_PER_SESSION})"
        )
        combined = combined[overflow:]

    s["rag_chunks"] = combined
    s["rag_files"] = existing_files + [{
        "filename": filename,
        "chunk_count": len(chunks),
        "char_count": sum(len(c.get("text", "")) for c in chunks),
    }]

    # Log memory estimate
    mem_est = _estimate_session_memory(s)
    logger.info(
        f"[session] Stored {len(chunks)} RAG chunks from '{filename}' for {session_id}. "
        f"Total chunks: {len(s['rag_chunks'])}, files: {len(s['rag_files'])}, "
        f"est. memory: {mem_est / 1024:.0f}KB"
    )


def get_rag_chunks(session_id: str) -> list[dict]:
    return get_session(session_id).get("rag_chunks", [])


def get_rag_files(session_id: str) -> list[dict]:
    return get_session(session_id).get("rag_files", [])


def clear_session(session_id: str):
    if session_id in _sessions:
        del _sessions[session_id]
        logger.info(f"[session] Cleared session {session_id}")


def get_session_stats() -> dict:
    """Return stats about active sessions (for monitoring)."""
    total_chunks = sum(len(s.get("rag_chunks", [])) for s in _sessions.values())
    total_files = sum(len(s.get("rag_files", [])) for s in _sessions.values())
    total_mem = sum(_estimate_session_memory(s) for s in _sessions.values())
    return {
        "active_sessions": len(_sessions),
        "max_sessions": MAX_SESSIONS,
        "total_rag_chunks": total_chunks,
        "total_rag_files": total_files,
        "estimated_memory_mb": round(total_mem / (1024 * 1024), 2),
    }
