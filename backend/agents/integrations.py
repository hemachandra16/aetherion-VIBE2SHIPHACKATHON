import json
import logging
import base64
from email.message import EmailMessage
from datetime import datetime, timedelta
from .gemini_client import call_gemini
from .session_store import get_session
from .oauth import get_credentials
from googleapiclient.discovery import build

logger = logging.getLogger("aetherion.integrations")


# ── Calendar: in-memory store + Real Google Calendar ─────────────────

def get_commitments(session_id: str = None) -> list[dict]:
    if session_id:
        session = get_session(session_id)
        return session.get("commitments", [])
    return []


def add_commitment(session_id: str, name: str, due_at: str, category: str = "task") -> dict:
    session = get_session(session_id)
    if "commitments" not in session:
        session["commitments"] = []

    try:
        due_dt = datetime.fromisoformat(due_at)
    except (ValueError, TypeError):
        due_dt = datetime.now() + timedelta(hours=3)

    time_until = due_dt - datetime.now()
    minutes_until = max(0, int(time_until.total_seconds() / 60))

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
    
    # Try to write to actual Google Calendar
    creds = get_credentials()
    if creds:
        try:
            service = build('calendar', 'v3', credentials=creds)
            event = {
              'summary': f"[Aetherion] {name}",
              'start': {
                'dateTime': datetime.now().isoformat() + 'Z',
                'timeZone': 'UTC',
              },
              'end': {
                'dateTime': due_dt.isoformat() + 'Z',
                'timeZone': 'UTC',
              },
            }
            service.events().insert(calendarId='primary', body=event).execute()
            logger.info(f"[integrations] Wrote '{name}' to real Google Calendar")
        except Exception as e:
            logger.error(f"[integrations] Failed to write to Google Calendar: {e}")

    logger.info(f"[integrations] Added commitment '{name}' due {due_dt} for {session_id}")
    return commitment


def _format_due(dt: datetime) -> str:
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


# ── Gmail: AI-generated email drafts & Real Sends ─────────────────────

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
    user_prompt = f"""Generate an email draft for this situation:

Context: {context}
{f'Recipient: {recipient_hint}' if recipient_hint else ''}
{f'Current situation: {situation}' if situation else ''}
{f'Recovery plan summary: {plan_summary}' if plan_summary else ''}

Generate an appropriate email the user can send to notify the affected party."""

    raw = await call_gemini(
        system_prompt=DRAFT_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        response_mime_type="application/json",
    )

    try:
        draft = json.loads(raw)
    except json.JSONDecodeError as e:
        draft = {
            "subject": "Update regarding schedule change",
            "body": raw,
            "tone": "professional",
            "suggested_recipients": [],
        }
    return draft

async def send_real_email(to_email: str, subject: str, body: str) -> dict:
    creds = get_credentials()
    if not creds:
        raise ValueError("No Google OAuth credentials found. Please authenticate first.")
        
    try:
        service = build('gmail', 'v1', credentials=creds)
        message = EmailMessage()
        message.set_content(body)
        message['To'] = to_email
        message['Subject'] = subject
        
        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        create_message = {'raw': encoded_message}
        
        send_message = service.users().messages().send(userId="me", body=create_message).execute()
        logger.info(f"[integrations] Sent email to {to_email}, message Id: {send_message['id']}")
        return {"success": True, "message_id": send_message['id']}
    except Exception as e:
        logger.error(f"[integrations] Failed to send real email: {e}")
        raise ValueError(f"Failed to send email: {e}")
