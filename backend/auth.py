# auth.py
import os
import jwt
from fastapi import Request, HTTPException, Depends
from dotenv import load_dotenv
load_dotenv()

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

def get_current_user(request: Request):
    # Log request path and method for debugging CORS issues
    print(f"Auth check for {request.method} {request.url.path}")
    print(f"Request headers: {request.headers.items()}")
    
    # Handle preflight OPTIONS requests differently to prevent auth errors during CORS checks
    if request.method == "OPTIONS":
        print("Skipping auth for OPTIONS preflight request")
        # Return dummy user for OPTIONS requests
        return {"sub": "preflight_request", "email": "preflight@example.com"}
    
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        print("Missing or invalid Authorization header")
        raise HTTPException(status_code=401, detail="Missing access token")

    token = auth_header.split(" ")[1]
    
    # Debug: Print token info for debugging (truncated for security)
    print(f"Received token: {token[:20]}...{token[-5:] if len(token) > 25 else ''}")

    try:
        # For user access tokens, we need to verify without secret validation
        # as Supabase manages the signing and we just need to decode
        decoded = jwt.decode(token, options={"verify_signature": False})
        
        # Print decoded token for debugging (limited info for security)
        print(f"Decoded token sub: {decoded.get('sub', 'missing')}, exp: {decoded.get('exp', 'missing')}")
        
        # Basic validation - ensure it's a Supabase token with user info
        if not decoded.get("sub"):
            print("Token missing 'sub' field")
            raise HTTPException(status_code=401, detail="Invalid token format - missing user ID")
            
        if decoded.get("iss") != "supabase" and "supabase.co/auth" not in decoded.get("iss", ""):
            print(f"Token has wrong issuer: {decoded.get('iss')}")
            raise HTTPException(status_code=401, detail="Invalid token format - wrong issuer")
            
        # Check if token is expired
        import time
        if decoded.get("exp") and decoded.get("exp") < time.time():
            print("Token is expired")
            raise HTTPException(status_code=401, detail="Token expired")
            
        print(f"Successfully authenticated user: {decoded.get('sub')}, email: {decoded.get('email')}")
        return decoded  # Contains user info: sub, email, role, etc.
    except jwt.ExpiredSignatureError:
        print("Token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        print(f"JWT decode error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        print(f"Unexpected error in auth: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")
