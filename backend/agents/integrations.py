"""
Google integrations — Calendar read + Gmail draft.
Uses Gemini to generate email drafts contextually.
Calendar uses a simple in-memory representation for now (real Google Calendar API 
requires OAuth 2.0 with the user's consent).
"""
import json
import logging
from datetime import datetime, timedelta
from .gemini_client import call_gemini
from .session_store import get_session

logger = logging.getLogger("aetherion.integrations")


# ── Calendar: in-memory store per session ─────────────────
# In production, this would call Google Calendar API with OAuth tokens.
# For the hackathon demo, users add commitments that show on the home screen
# and get factored into the crisis planning pipeline.

def get_commitments(session_id: str = None) -> list[dict]:
    """Get all commitments. If session_id is given, return session-specific ones."""
    if session_id:
        session = get_session(session_id)
        return session.get("commitments", [])
    return []


def add_commitment(session_id: str, name: str, due_at: str, category: str = "task") -> dict:
    """
    Add a commitment (calendar event / deadline) to the session.
    due_at: ISO datetime string or relative like "in 3 hours"
    """
    session = get_session(session_id)
    if "commitments" not in session:
        session["commitments"] = []

    # Parse due time
    try:
        due_dt = datetime.fromisoformat(due_at)
    except (ValueError, TypeError):
        # Handle relative time like "in 3 hours" or "tomorrow 9am"
        due_dt = datetime.now() + timedelta(hours=3)  # fallback

    time_until = due_dt - datetime.now()
    minutes_until = max(0, int(time_until.total_seconds() / 60))

    # Determine status
    if minutes_until < 60:
        status = "critical"
        status_label = "URGENT"
    elif minutes_until < 240:
        status = "soon"
        status_label = "SOON"
    else:
        status = "ok"
        status_label = "ON TRACK"

    commitment = {
        "name": name,
        "due_at": due_dt.isoformat(),
        "due_label": _format_due(due_dt),
        "category": category,
        "status": status,
        "status_label": status_label,
        "minutes_until": minutes_until,
        "completed": False,
    }
    session["commitments"].append(commitment)
    logger.info(f"[integrations] Added commitment '{name}' due {due_dt} for {session_id}")
    return commitment


def _format_due(dt: datetime) -> str:
    """Format a datetime into a human-friendly due label."""
    now = datetime.now()
    diff = dt - now
    if diff.total_seconds() < 0:
        return "Overdue"
    hours = diff.total_seconds() / 3600
    if hours < 1:
        return f"Due in {int(diff.total_seconds()/60)}m"
    if hours < 24:
        return f"Due in {int(hours)}h {int((hours % 1) * 60)}m"
    return f"Due {dt.strftime('%b %d, %I:%M %p')}"


# ── Gmail: AI-generated email drafts ─────────────────────

DRAFT_SYSTEM_PROMPT = """You are Aetherion's email assistant. Given a crisis context, 
generate a professional, empathetic email or message that the user can send to notify 
affected parties about their situation.

Rules:
1. Be honest but professional — no excessive apologies
2. Include specific details from the context (deadlines, what's affected)
3. Propose a revised timeline if possible
4. Keep it concise — 3-5 paragraphs max
5. Include a subject line

Output ONLY valid JSON:
{
  "subject": "email subject line",
  "body": "full email body text",
  "tone": "professional" | "casual" | "urgent",
  "suggested_recipients": ["description of who should receive this"]
}"""


async def generate_email_draft(
    context: str,
    recipient_hint: str = "",
    situation: str = "",
    plan_summary: str = "",
) -> dict:
    """
    Generate a contextual email draft using Gemini.
    Returns: { subject, body, tone, suggested_recipients }
    """
    user_prompt = f"""Generate an email draft for this situation:

Context: {context}
{f'Recipient: {recipient_hint}' if recipient_hint else ''}
{f'Current situation: {situation}' if situation else ''}
{f'Recovery plan summary: {plan_summary}' if plan_summary else ''}

Generate an appropriate email the user can send to notify the affected party."""

    logger.info(f"[integrations] Generating email draft for: {context[:60]}...")

    raw = await call_gemini(
        system_prompt=DRAFT_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_mime_type="application/json",
    )

    try:
        draft = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"[integrations] Draft parse error: {e}")
        draft = {
            "subject": "Update regarding schedule change",
            "body": raw,
            "tone": "professional",
            "suggested_recipients": [],
        }

    logger.info(f"[integrations] Draft generated: subject='{draft.get('subject')}'")
    return draft
