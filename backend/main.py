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
from dotenv import load_dotenv

load_dotenv()

from agents.pipeline import run_agent_pipeline, update_step_status
from agents.rag import process_upload, get_rag_context
from agents.confidence import calculate_confidence

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ─────────────────────────────────────────
@app.get("/api/health")
async def health():
    has_key = bool(os.getenv("GEMINI_API_KEY"))
    return {"status": "ok", "gemini_key_set": has_key}


# ── Chat / Agent pipeline ───────────────────────────────
@app.post("/api/chat")
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
                "message": f"Agent pipeline failed: {str(e)}",
            },
        )


# ── File upload (RAG) ───────────────────────────────────
@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), session_id: str = Form("default")):
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

    logger.info(f"[upload] session={session_id} file={file.filename}")

    try:
        content = await file.read()
        result = await process_upload(
            file_bytes=content,
            filename=file.filename,
            session_id=session_id,
        )
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"[upload] Error: {e}\n{traceback.format_exc()}")
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "error_type": "UPLOAD_ERROR",
                "message": f"File processing failed: {str(e)}",
            },
        )


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


# ── SPA catch-all — must come AFTER all /api/* routes ────────────
# Serves the React frontend from the dist/ directory if it exists.
# On Cloud Run the Dockerfile builds the frontend first and copies dist/ here.
import os as _os

_DIST = _os.path.join(_os.path.dirname(__file__), "dist")
if _os.path.isdir(_DIST):
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=_os.path.join(_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_catchall(full_path: str):
        """Return index.html for all non-API routes (SPA client-side routing)."""
        index = _os.path.join(_DIST, "index.html")
        if _os.path.isfile(index):
            return FileResponse(index)
        return JSONResponse(status_code=404, content={"error": "Frontend not built"})
