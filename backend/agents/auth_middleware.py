import os
from fastapi import Request, HTTPException
from firebase_admin import auth, credentials, initialize_app

# Initialize Firebase Admin once
_firebase_app = None

def get_firebase_app():
    global _firebase_app
    if not _firebase_app:
        project_id = os.getenv("FIREBASE_PROJECT_ID", "aethiron-90a06")
        try:
            # Check if default app is already initialized
            from firebase_admin import get_app
            _firebase_app = get_app()
        except ValueError:
            # Initialize with just project_id for token verification (no service account needed)
            _firebase_app = initialize_app(options={'projectId': project_id})
    return _firebase_app

async def verify_firebase_token(request: Request):
    """
    FastAPI Dependency to verify Firebase Auth ID token from the Authorization header.
    Expects header: `Authorization: Bearer <token>`
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        # For dev bypass mode, allow it if it has a special dev token (or just skip for hackathon)
        # We will enforce it strictly in production.
        dev_mode = os.getenv("VITE_DEV_MODE") == "true"
        if dev_mode and request.headers.get("X-Dev-Bypass") == "true":
            return {"uid": "dev-user-bypass", "email": "dev@aetherion.local"}
            
        raise HTTPException(
            status_code=401, 
            detail="Missing or invalid Authorization header. Must be 'Bearer <token>'"
        )

    token = auth_header.split("Bearer ")[1]
    
    try:
        get_firebase_app() # Ensure app is initialized
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase ID token: {str(e)}")
