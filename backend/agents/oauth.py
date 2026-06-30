import os
import json
import logging
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
import google.oauth2.credentials

from .session_store import get_session

# Allow HTTP traffic for local dev OAuth testing only
if os.getenv("ENV") == "development" or os.getenv("OAUTHLIB_INSECURE_TRANSPORT"):
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

logger = logging.getLogger("aetherion.oauth")

router = APIRouter(prefix="/api/oauth")

# Scopes needed for Calendar and Gmail
SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.send"
]

def get_client_config():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise RuntimeError("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment")
    
    base_url = os.getenv("BASE_URL", "http://localhost:8000")

    return {
        "web": {
            "client_id": client_id,
            "project_id": os.getenv("FIREBASE_PROJECT_ID", "aethiron-90a06"),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": client_secret,
            "redirect_uris": [f"{base_url}/api/oauth/callback"]
        }
    }

@router.get("/login")
async def oauth_login(session_id: str):
    """Initiates the OAuth 2.0 flow by redirecting the user to Google."""
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
        
    try:
        flow = Flow.from_client_config(
            get_client_config(),
            scopes=SCOPES,
            redirect_uri=f"{base_url}/api/oauth/callback"
        )
        # Pass the session_id through the state parameter
        auth_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        # Store state temporarily in the session to verify later
        session = get_session(session_id)
        session['oauth_state'] = state
        
        # Return a RedirectResponse so the browser navigates to the Google consent screen
        return RedirectResponse(url=auth_url)
    except Exception as e:
        logger.error(f"[oauth] Login failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/callback")
async def oauth_callback(request: Request, state: str = None, code: str = None):
    """Handles the callback from Google after user grants consent."""
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing code or state")
        
    try:
        base_url = os.getenv("BASE_URL", "http://localhost:8000")
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

        flow = Flow.from_client_config(
            get_client_config(),
            scopes=SCOPES,
            redirect_uri=f"{base_url}/api/oauth/callback"
        )
        
        flow.fetch_token(authorization_response=str(request.url))
        credentials = flow.credentials
        
        from .session_store import get_session
        matched_session_id = None
        # Let's write the credentials to a local file so integrations.py can pick them up.
        
        creds_data = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
        
        with open("oauth_token.json", "w") as f:
            json.dump(creds_data, f)
            
        logger.info("[oauth] Successfully acquired and stored OAuth tokens")
        
        # Redirect back to the frontend Disruption screen
        return RedirectResponse(url=f"{frontend_url}/disruption?oauth=success")
        
    except Exception as e:
        logger.error(f"[oauth] Callback failed: {e}")
        return RedirectResponse(url=f"http://localhost:5173/disruption?oauth=error")

def get_credentials():
    """Load credentials from file if they exist."""
    if os.path.exists("oauth_token.json"):
        try:
            with open("oauth_token.json", "r") as f:
                creds_data = json.load(f)
            return google.oauth2.credentials.Credentials(
                token=creds_data['token'],
                refresh_token=creds_data['refresh_token'],
                token_uri=creds_data['token_uri'],
                client_id=creds_data['client_id'],
                client_secret=creds_data['client_secret'],
                scopes=creds_data['scopes']
            )
        except Exception as e:
            logger.error(f"[oauth] Error loading token: {e}")
            return None
    return None
