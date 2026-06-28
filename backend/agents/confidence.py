"""
Live confidence meter.
Recalculates from real plan state: steps completed, time elapsed vs time budgeted.
Never returns a static or hardcoded number.
"""
import time
import logging
from .session_store import get_session

logger = logging.getLogger("aetherion.confidence")


def calculate_confidence(session_id: str) -> dict:
    """
    Calculate confidence score from real plan state.

    Formula:
    - Start with base 85% (optimistic but not certain)
    - Progress bonus: +15% * (completed_steps / total_non_cut_steps)
    - Time penalty: if time_elapsed > expected_time_elapsed → penalty proportional to lag
    - Floor: 5%, Ceiling: 98%

    Returns: { "score": int, "label": str, "completed": int, "total": int,
               "time_elapsed_minutes": float, "trend": "up"|"down"|"stable" }
    """
    session = get_session(session_id)
    plan_steps = session.get("plan")
    plan_started_at = session.get("plan_started_at")
    triage_result = session.get("triage_result")

    if not plan_steps:
        return {
            "score": 0,
            "label": "No plan yet",
            "completed": 0,
            "total": 0,
            "time_elapsed_minutes": 0,
            "trend": "stable",
        }

    # Non-cut steps only (steps that are actually in the plan)
    active_steps = [s for s in plan_steps if not s.get("cut", False)]
    completed_steps = [s for s in active_steps if s.get("completed", False)]
    total_active = len(active_steps)
    total_completed = len(completed_steps)

    # Progress ratio
    progress_ratio = total_completed / total_active if total_active > 0 else 0.0

    # Time elapsed
    time_elapsed_minutes = 0.0
    if plan_started_at:
        time_elapsed_minutes = (time.time() - plan_started_at) / 60.0

    # Expected progress at this point in time
    time_remaining_minutes = 0
    if triage_result:
        time_remaining_minutes = triage_result.get("time_remaining_minutes") or 0

    total_plan_minutes = sum(
        s.get("duration_minutes", 0) for s in active_steps
    )

    time_score_penalty = 0
    if total_plan_minutes > 0 and time_remaining_minutes > 0:
        expected_progress = min(time_elapsed_minutes / total_plan_minutes, 1.0)
        lag = expected_progress - progress_ratio  # positive = behind schedule
        if lag > 0.1:  # more than 10% behind
            time_score_penalty = int(lag * 40)  # max 40 point penalty

    # Base score calculation
    base = 85
    progress_bonus = int(progress_ratio * 15)
    score = max(5, min(98, base + progress_bonus - time_score_penalty))

    # Label
    if score >= 80:
        label = "On track"
    elif score >= 60:
        label = "At risk"
    elif score >= 40:
        label = "Behind schedule"
    else:
        label = "Critical — replanning needed"

    # Trend (simple: if more than half done, trending up; if behind, trending down)
    if time_score_penalty > 10:
        trend = "down"
    elif progress_ratio > 0.3:
        trend = "up"
    else:
        trend = "stable"

    logger.debug(
        f"[confidence] session={session_id}: score={score}%, "
        f"completed={total_completed}/{total_active}, "
        f"elapsed={time_elapsed_minutes:.1f}m, penalty={time_score_penalty}"
    )

    return {
        "score": score,
        "label": label,
        "completed": total_completed,
        "total": total_active,
        "time_elapsed_minutes": round(time_elapsed_minutes, 1),
        "trend": trend,
    }
