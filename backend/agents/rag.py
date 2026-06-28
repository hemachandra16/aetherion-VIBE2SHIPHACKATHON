"""
RAG layer — file upload, chunking, embedding, retrieval.
Uses gemini-embedding-001 for embeddings, numpy cosine similarity for retrieval.
No FAISS dependency — simpler, zero install risk.
"""
import io
import math
import logging
import numpy as np
from typing import Optional

from .gemini_client import get_embeddings
from .session_store import store_rag_chunks, get_rag_chunks

logger = logging.getLogger("aetherion.rag")

CHUNK_SIZE = 400        # characters per chunk
CHUNK_OVERLAP = 80      # character overlap between chunks
TOP_K = 5               # top chunks to retrieve


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping character-level chunks."""
    chunks = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = min(start + chunk_size, text_len)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= text_len:
            break
        start = end - overlap
    return chunks


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF bytes using pypdf with pdfplumber fallback."""
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        full_text = "\n\n".join(pages)
        if full_text.strip():
            logger.info(f"[rag] pypdf extracted {len(full_text)} chars from {len(reader.pages)} pages")
            return full_text
        raise ValueError("pypdf returned empty text")
    except Exception as e:
        logger.warning(f"[rag] pypdf failed ({e}), trying pdfplumber")
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                pages = []
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        pages.append(text)
            full_text = "\n\n".join(pages)
            logger.info(f"[rag] pdfplumber extracted {len(full_text)} chars")
            return full_text
        except Exception as e2:
            raise RuntimeError(f"PDF text extraction failed with both pypdf and pdfplumber: {e2}")


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors."""
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


async def process_upload(file_bytes: bytes, filename: str, session_id: str) -> dict:
    """
    Full RAG pipeline: extract → chunk → embed → store.
    Returns metadata about what was processed.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    # ── Extract text ─────────────────────────────────────
    if ext == "pdf":
        raw_text = _extract_text_from_pdf(file_bytes)
    elif ext in ("txt", "md"):
        raw_text = file_bytes.decode("utf-8", errors="replace")
        logger.info(f"[rag] Text file: {len(raw_text)} chars")
    else:
        raise ValueError(f"Unsupported file type: .{ext}")

    if not raw_text.strip():
        raise ValueError("The uploaded file appears to be empty or contains no extractable text")

    # ── Chunk ─────────────────────────────────────────────
    chunks = _chunk_text(raw_text)
    if not chunks:
        raise ValueError("No text chunks could be created from the file")
    logger.info(f"[rag] Created {len(chunks)} chunks from '{filename}'")

    # ── Embed ─────────────────────────────────────────────
    logger.info(f"[rag] Embedding {len(chunks)} chunks via gemini-embedding-001...")
    embeddings = await get_embeddings(chunks)

    # ── Store ─────────────────────────────────────────────
    chunk_records = [
        {"text": text, "embedding": emb}
        for text, emb in zip(chunks, embeddings)
    ]
    store_rag_chunks(session_id, chunk_records, filename)

    return {
        "success": True,
        "filename": filename,
        "chunk_count": len(chunks),
        "char_count": len(raw_text),
        "session_id": session_id,
        "message": f"Indexed {len(chunks)} chunks from '{filename}'",
    }


def get_rag_context(session_id: str, query: str, top_k: int = TOP_K) -> str:
    """
    Retrieve top-k most relevant chunks for the query.
    Returns empty string if no RAG data is available for this session.
    """
    chunks = get_rag_chunks(session_id)
    if not chunks:
        return ""

    # We need to embed the query synchronously — but we're in a sync context from pipeline.
    # We'll skip query embedding and use keyword overlap as a lightweight fallback.
    # For proper cosine retrieval, the pipeline calls get_rag_context_async.
    # This function is the quick sync version used inside the pipeline.
    query_lower = query.lower()
    query_words = set(query_lower.split())

    scored = []
    for chunk in chunks:
        text_lower = chunk["text"].lower()
        # Simple TF-IDF approximation: count query word hits
        hits = sum(1 for w in query_words if w in text_lower)
        scored.append((hits, chunk["text"]))

    scored.sort(key=lambda x: -x[0])
    top_chunks = [text for _, text in scored[:top_k] if text]

    if not top_chunks:
        return ""

    context = "\n\n---\n\n".join(top_chunks)
    logger.info(f"[rag] Retrieved {len(top_chunks)} chunks for query (keyword mode)")
    return context


async def get_rag_context_with_embeddings(
    session_id: str, query: str, top_k: int = TOP_K
) -> str:
    """
    Retrieve top-k chunks using real cosine similarity on embeddings.
    Use this when you have an async context and want full semantic search.
    """
    chunks = get_rag_chunks(session_id)
    if not chunks:
        return ""

    # Embed the query
    query_embeddings = await get_embeddings([query])
    query_vec = query_embeddings[0]

    # Score all chunks
    scored = []
    for chunk in chunks:
        emb = chunk.get("embedding")
        if emb:
            score = _cosine_similarity(query_vec, emb)
            scored.append((score, chunk["text"]))

    scored.sort(key=lambda x: -x[0])
    top_chunks = [text for _, text in scored[:top_k]]

    context = "\n\n---\n\n".join(top_chunks)
    logger.info(
        f"[rag] Retrieved {len(top_chunks)} chunks via cosine similarity for session={session_id}"
    )
    return context
