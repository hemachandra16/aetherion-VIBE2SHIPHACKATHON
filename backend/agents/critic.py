"""
Critic Agent.
Input: Planner's draft plan.
Checks: do step durations fit in the time budget? Is ordering logical?
If infeasible: returns revised plan (one revision loop, not unbounded).
The revision loop is exposed in the API response so the UI can show "revising plan..." state.
"""
import json
import logging
from .gemini_client import call_gemini

logger = logging.getLogger("aetherion.critic")

CRITIC_SYSTEM_PROMPT = """You are the Critic Agent for Aetherion, an AI crisis planner.
Your job: review a draft plan and check its feasibility.

Check these things:
1. Do the total non-cut step durations fit within time_remaining_minutes (with a reasonable buffer)?
2. Is the step ordering logically sound? (e.g., can't submit before reviewing, can't write conclusion before introduction)
3. Are any steps so vague they give no actionable direction?

If the plan is FEASIBLE:
- Output { "feasible": true, "revised_plan": null, "critique_notes": "brief reason it passes" }

If the plan is INFEASIBLE:
- Cut the lowest-priority steps (those with cut_if_behind: true) first.
- If cutting isn't enough, shorten the longest steps proportionally.
- Return a REVISED complete plan with the same JSON structure as the input, but corrected.
- Output { "feasible": false, "revised_plan": { ...full corrected plan... }, "critique_notes": "what you changed and why" }

Output ONLY valid JSON. Never output both feasible=true and a revised_plan."""

CRITIC_USER_TEMPLATE = """Review this draft plan:
{plan_json}

Time remaining: {time_remaining} minutes.
Is it feasible? If not, revise it. Return your Critic response JSON."""


async def run_critic(plan: dict, time_remaining_minutes: int) -> dict:
    """
    Critique the plan. Returns:
    { "feasible": bool, "final_plan": dict, "critique_notes": str, "was_revised": bool }
    """
    plan_json = json.dumps(plan, indent=2)

    user_prompt = CRITIC_USER_TEMPLATE.format(
        plan_json=plan_json,
        time_remaining=time_remaining_minutes,
    )

    logger.info(
        f"[critic] Reviewing plan '{plan.get('plan_title')}' "
        f"({len(plan.get('steps', []))} steps, {plan.get('total_minutes_budgeted')}m budgeted, "
        f"{time_remaining_minutes}m available)"
    )

    raw = await call_gemini(
        system_prompt=CRITIC_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_mime_type="application/json",
    )

    try:
        critic_result = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"[critic] Failed to parse Gemini JSON: {e}\nRaw: {raw[:200]}")
        raise RuntimeError(f"Critic agent returned invalid JSON: {e}")

    feasible = critic_result.get("feasible", True)
    revised = critic_result.get("revised_plan")
    notes = critic_result.get("critique_notes", "")

    if feasible:
        logger.info(f"[critic] Plan is FEASIBLE. Notes: {notes}")
        return {
            "feasible": True,
            "final_plan": plan,
            "critique_notes": notes,
            "was_revised": False,
        }
    else:
        if not revised or "steps" not in revised:
            # Critic said infeasible but didn't provide a valid revision — use original with a warning
            logger.warning("[critic] Critic said infeasible but provided no valid revision. Using original plan.")
            return {
                "feasible": False,
                "final_plan": plan,
                "critique_notes": f"[WARNING: Critic revision malformed] {notes}",
                "was_revised": False,
            }
        logger.info(
            f"[critic] Plan REVISED. {len(revised.get('steps', []))} steps after revision. Notes: {notes}"
        )
        return {
            "feasible": False,
            "final_plan": revised,
            "critique_notes": notes,
            "was_revised": True,
        }
