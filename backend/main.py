"""
Aetherion Backend — FastAPI entry point.
All values shown to users must trace to real user input or real Gemini output.
No hardcoded example scenarios anywhere.
"""
import os
import json
import logging
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

load_dotenv()

limiter = Limiter(key_func=get_remote_address)

from agents.pipeline import run_agent_pipeline, update_step_status
from agents.rag import process_upload, get_rag_context
from agents.confidence import calculate_confidence
from agents.integrations import get_commitments, add_commitment, generate_email_draft, send_real_email
from agents.oauth import router as oauth_router
from agents.session_store import (
    get_session_stats,
    get_rag_files,
    MAX_FILE_SIZE_BYTES,
    MAX_FILES_PER_SESSION,
)

# ── Logging ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("aetherion")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Aetherion backend starting up")
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        logger.error("GEMINI_API_KEY not set — agent pipeline will fail loudly on first call")
    else:
        logger.info("GEMINI_API_KEY is set")
    yield
    logger.info("Aetherion backend shutting down")


app = FastAPI(
    title="Aetherion API",
    description="The Last-Minute Life Saver — backend",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://aetherion-308059826502.asia-south1.run.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(oauth_router)


# ── Health check ─────────────────────────────────────────
@app.get("/api/health")
async def health():
    has_key = bool(os.getenv("GEMINI_API_KEY"))
    stats = get_session_stats()
    return {"status": "ok", "gemini_key_set": has_key, "sessions": stats}


# ── Chat / Agent pipeline ───────────────────────────────
@app.post("/api/chat")
@limiter.limit("10/minute")
async def chat(request: Request):
    """
    Accepts: { "message": str, "session_id": str, "conversation_history": [...] }
    Returns the agent pipeline result — may be a clarifying question (from Triage)
    or a full plan (from Planner→Critic→Executor).
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    message = body.get("message", "").strip()
    session_id = body.get("session_id", "default")
    history = body.get("conversation_history", [])

    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    if len(message) > 10000:
        raise HTTPException(status_code=400, detail="Message too long (max 10,000 characters)")
    if len(history) > 20:
        history = history[-20:]
    session_id = str(session_id)[:128]

    logger.info(f"[chat] session={session_id} message={message[:80]}...")

    try:
        result = await run_agent_pipeline(
            user_message=message,
            session_id=session_id,
            conversation_history=history,
        )
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"[chat] Pipeline error: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "error_type": "PIPELINE_ERROR",
                "message": "An internal error occurred. Please try again.",
            },
        )


# ── File upload (RAG) ───────────────────────────────────
@app.post("/api/upload")
@limiter.limit("5/minute")
async def upload_file(request: Request, file: UploadFile = File(...), session_id: str = Form("default")):
    """Upload a PDF/text file for RAG grounding."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed = (".pdf", ".txt", ".md")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(allowed)}",
        )

    # Check file count limit BEFORE reading the file (saves memory)
    existing_files = get_rag_files(session_id)
    if len(existing_files) >= MAX_FILES_PER_SESSION:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_FILES_PER_SESSION} files per session reached. "
                   f"Already uploaded: {', '.join(f['filename'] for f in existing_files)}",
        )

    logger.info(f"[upload] session={session_id} file={file.filename}")

    try:
        content = await file.read()

        # Enforce file size limit — check AFTER read (UploadFile doesn't know size upfront)
        if len(content) > MAX_FILE_SIZE_BYTES:
            size_mb = len(content) / (1024 * 1024)
            limit_mb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
            raise HTTPException(
                status_code=400,
                detail=f"File too large ({size_mb:.1f} MB). Maximum: {limit_mb:.0f} MB",
            )

        result = await process_upload(
            file_bytes=content,
            filename=file.filename,
            session_id=session_id,
        )

        # Include list of all uploaded files in the response
        all_files = get_rag_files(session_id)
        result["uploaded_files"] = all_files
        result["files_remaining"] = MAX_FILES_PER_SESSION - len(all_files)

        return JSONResponse(content=result)
    except HTTPException:
        raise  # Re-raise HTTP exceptions (file size, file count)
    except Exception as e:
        logger.error(f"[upload] Error: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "error_type": "UPLOAD_ERROR",
                "message": "File processing failed. Please try again.",
            },
        )


# ── Session files info ──────────────────────────────────
@app.get("/api/files/{session_id}")
async def get_files(session_id: str):
    """Get list of uploaded files and limits for a session."""
    files = get_rag_files(session_id)
    return {
        "files": files,
        "count": len(files),
        "max": MAX_FILES_PER_SESSION,
        "remaining": MAX_FILES_PER_SESSION - len(files),
    }


# ── Step completion / confidence ─────────────────────────
@app.post("/api/step/complete")
async def complete_step(request: Request):
    """Mark a plan step as done — triggers confidence recalculation."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    session_id = body.get("session_id", "default")
    step_index = body.get("step_index")

    if step_index is None:
        raise HTTPException(status_code=400, detail="step_index is required")

    try:
        result = update_step_status(session_id, step_index, completed=True)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"[step/complete] Error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": True, "message": str(e)},
        )


@app.get("/api/confidence/{session_id}")
async def get_confidence(session_id: str):
    """Get current confidence score for a session."""
    try:
        result = calculate_confidence(session_id)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"[confidence] Error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": True, "message": str(e)},
        )


# ── Commitments (Calendar) ────────────────────────────────
@app.get("/api/commitments/{session_id}")
async def list_commitments(session_id: str):
    """Get all commitments for a session (calendar events / deadlines)."""
    try:
        items = get_commitments(session_id)
        return JSONResponse(content={"commitments": items, "count": len(items)})
    except Exception as e:
        logger.error(f"[commitments] Error: {e}")
        return JSONResponse(status_code=500, content={"error": True, "message": str(e)})


@app.post("/api/commitments")
async def create_commitment(request: Request):
    """Add a commitment (deadline / calendar event) to a session."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    session_id = body.get("session_id", "default")
    name = body.get("name", "").strip()
    due_at = body.get("due_at", "")
    category = body.get("category", "task")

    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    try:
        result = add_commitment(session_id, name, due_at, category)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"[commitments] Error: {e}")
        return JSONResponse(status_code=500, content={"error": True, "message": str(e)})


# ── Email Draft (Gmail) ──────────────────────────────────
@app.post("/api/email/draft")
@limiter.limit("5/minute")
async def draft_email(request: Request):
    """Generate an AI-written email draft for crisis communication."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    context = body.get("context", "").strip()
    recipient = body.get("recipient", "")
    situation = body.get("situation", "")
    plan_summary = body.get("plan_summary", "")

    if not context:
        raise HTTPException(status_code=400, detail="context is required")

    try:
        draft = await generate_email_draft(
            context=context,
            recipient_hint=recipient,
            situation=situation,
            plan_summary=plan_summary,
        )
        return JSONResponse(content=draft)
    except Exception as e:
        logger.error(f"[email/draft] Error: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": True, "message": "Draft generation failed. Please try again."},
        )


@app.post("/api/email/send")
@limiter.limit("3/minute")
async def send_email_real(request: Request):
    """Sends the actual email using the Gmail API."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    to_email = body.get("to_email", "").strip()
    subject = body.get("subject", "").strip()
    email_body = body.get("body", "").strip()

    if not to_email or not email_body:
        raise HTTPException(status_code=400, detail="to_email and body are required")

    try:
        result = await send_real_email(to_email=to_email, subject=subject, body=email_body)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"[email/send] Error: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={"error": True, "message": "Email send failed. Please check authentication and try again."},
        )

# ── SPA catch-all — must come AFTER all /api/* routes ────────────
# Serves the React frontend from the dist/ directory if it exists.
# On Cloud Run the Dockerfile builds the frontend first and copies dist/ here.
import os as _os

_DIST = _os.path.join(_os.path.dirname(__file__), "dist")
if _os.path.isdir(_DIST):
    # Serve static assets (JS, CSS, images)
    _assets_dir = _os.path.join(_DIST, "assets")
    if _os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_catchall(full_path: str):
        """Return index.html for all non-API routes (SPA client-side routing)."""
        # First check if a specific static file exists (e.g. favicon)
        file_path = _os.path.join(_DIST, full_path)
        real_path = _os.path.realpath(file_path)
        if full_path and _os.path.isfile(file_path) and real_path.startswith(_os.path.realpath(_DIST)):
            return FileResponse(file_path)
        # Otherwise return index.html for client-side routing
        index = _os.path.join(_DIST, "index.html")
        if _os.path.isfile(index):
            from fastapi.responses import HTMLResponse
            with open(index, "r", encoding="utf-8") as f:
                content = f.read()
            resp = HTMLResponse(content=content)
            resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            resp.headers["Pragma"] = "no-cache"
            resp.headers["Expires"] = "0"
            return resp
        return JSONResponse(status_code=404, content={"error": "Frontend not built"})
