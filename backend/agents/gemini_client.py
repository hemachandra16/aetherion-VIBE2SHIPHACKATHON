"""
Shared Gemini client configuration.
Model lock: gemini-2.5-flash for reasoning fallback,
gemini-embedding-001 for embeddings.
Never substitute models without explicit approval.
"""
import os
import asyncio
import logging
from google import genai
from google.genai import types

logger = logging.getLogger("aetherion.gemini")

REASONING_MODEL = "gemini-3.5-flash"
EMBEDDING_MODEL = "gemini-embedding-001"

_client = None


def get_client() -> genai.Client:
    """Get or create the Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY environment variable is not set. "
                "The agent pipeline cannot function without it."
            )
        _client = genai.Client(api_key=api_key)
        logger.info(f"Gemini client initialized (reasoning={REASONING_MODEL}, embedding={EMBEDDING_MODEL})")
    return _client


async def call_gemini(
    system_prompt: str,
    user_prompt: str,
    response_mime_type: str = "application/json",
    max_retries: int = 5,
) -> str:
    """
    Call the reasoning model with exponential backoff on 503/transient failures.
    Retries up to 5 times with backoff: 5s, 10s, 20s, 40s, 80s.
    Returns the raw text response.
    """
    client = get_client()
    last_error = None

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=REASONING_MODEL,
                contents=[
                    types.Content(
                        role="user",
                        parts=[types.Part(text=user_prompt)],
                    )
                ],
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type=response_mime_type,
                    temperature=0.7,
                ),
            )
            if response.text:
                return response.text
            else:
                raise RuntimeError("Gemini returned empty response")
        except Exception as e:
            last_error = e
            # Longer backoff to handle demand spikes: 5s, 10s, 20s, 40s, 80s
            wait = (2 ** attempt) * 5.0
            logger.warning(
                f"Gemini call attempt {attempt + 1}/{max_retries} failed: {e}. "
                f"Retrying in {wait}s with same model {REASONING_MODEL}"
            )
            if attempt < max_retries - 1:
                await asyncio.sleep(wait)

    # Determine if this is a rate limit or a different error
    error_str = str(last_error)
    if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
        raise RuntimeError(
            "Gemini API rate limit reached. The free tier allows 20 requests/day per model. "
            "Please wait a few minutes and try again, or upgrade your API key at https://ai.google.dev"
        )
    elif "503" in error_str or "UNAVAILABLE" in error_str:
        raise RuntimeError(
            "Gemini service is temporarily unavailable due to high demand. "
            "Please try again in a minute."
        )
    else:
        raise RuntimeError(
            f"AI reasoning failed after {max_retries} attempts. Please try again. "
            f"Error: {type(last_error).__name__}"
        )


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Get embeddings using gemini-embedding-001.
    Returns list of embedding vectors.
    """
    client = get_client()
    embeddings = []

    # Process in batches of 100 (API limit)
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        try:
            result = client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=batch,
            )
            for embedding in result.embeddings:
                embeddings.append(embedding.values)
        except Exception as e:
            logger.error(f"Embedding call failed on batch {i // batch_size}: {e}")
            raise RuntimeError(
                f"Embedding failed on model {EMBEDDING_MODEL}: {e}"
            )

    logger.info(f"Generated {len(embeddings)} embeddings via {EMBEDDING_MODEL}")
    return embeddings
