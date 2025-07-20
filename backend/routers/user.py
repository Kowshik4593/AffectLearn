# routers/user.py

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from datetime import datetime
import uuid

from auth import get_current_user
from db import get_db_connection

router = APIRouter()

@router.get("/user/ping")
async def ping_user_service(request: Request):
    """
    A simple endpoint that doesn't require authentication to test CORS and connectivity
    """
    headers = {k: v for k, v in request.headers.items()}
    # Filter out some headers for security
    if 'authorization' in headers:
        headers['authorization'] = '***REDACTED***'
    
    return {
        "status": "ok", 
        "message": "User service is running",
        "timestamp": datetime.utcnow().isoformat(),
        "request_method": request.method,
        "request_url": str(request.url),
        "headers_received": headers
    }

class CreateUserRequest(BaseModel):
    email: str
    first_name: str = None
    last_name: str = None

@router.post("/create_user/")
async def create_user(request: CreateUserRequest, user=Depends(get_current_user)):
    """
    Create a user record in the public.users table.
    This should be called after successful Supabase auth signup.
    """
    try:
        user_id = user["sub"]  # Supabase UUID from JWT
        email = user.get("email", request.email)
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Use UPSERT to handle race conditions
            cur.execute("""
                INSERT INTO users (id, email, first_name, last_name, created_at, last_login)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    first_name = COALESCE(EXCLUDED.first_name, users.first_name),
                    last_name = COALESCE(EXCLUDED.last_name, users.last_name),
                    last_login = EXCLUDED.last_login
                RETURNING id, email
            """, (
                user_id,
                email,
                request.first_name,
                request.last_name,
                datetime.utcnow(),
                datetime.utcnow()
            ))
            
            result = cur.fetchone()
            
            return {
                "message": "User created/updated successfully",
                "user_id": result[0] if result else user_id,
                "email": result[1] if result else email,
                "action": "created" if result else "updated"
            }
            
    except Exception as e:
        # Log the error but don't fail the auth process
        print(f"User creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")

@router.post("/sync_user/")
async def sync_user_from_auth(user=Depends(get_current_user)):
    """
    Sync user from auth.users to public.users table.
    Fallback method if triggers don't work.
    """
    try:
        user_id = user["sub"]
        email = user.get("email")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not found in token")
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Get user data from auth.users table
            cur.execute("""
                SELECT id, email, created_at, last_sign_in_at
                FROM auth.users 
                WHERE id = %s
            """, (user_id,))
            
            auth_user = cur.fetchone()
            
            if not auth_user:
                raise HTTPException(status_code=404, detail="User not found in auth system")
            
            # Sync to public.users
            cur.execute("""
                INSERT INTO users (id, email, created_at, last_login)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    last_login = EXCLUDED.last_login
                RETURNING id
            """, (
                auth_user[0],  # id
                auth_user[1],  # email
                auth_user[2],  # created_at
                auth_user[3] or datetime.utcnow()  # last_sign_in_at
            ))
            
            return {
                "message": "User synced successfully",
                "user_id": user_id,
                "email": email
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync user: {str(e)}")

async def _get_user_profile_data(user):
    """Shared function to get user profile data"""
    try:
        user_id = user["sub"]
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, email, username, first_name, last_name, created_at, last_login
                FROM users WHERE id = %s
            """, (user_id,))
            
            user_data = cur.fetchone()
            
            if not user_data:
                raise HTTPException(status_code=404, detail="User not found in database")
            
            return {
                "id": user_data[0],
                "email": user_data[1],
                "username": user_data[2],
                "first_name": user_data[3],
                "last_name": user_data[4],
                "created_at": user_data[5],
                "last_login": user_data[6]
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user profile: {str(e)}")

@router.get("/user/profile")
async def get_user_profile_no_slash(user=Depends(get_current_user)):
    """Get user profile from public.users table (alternative route without trailing slash)"""
    return await _get_user_profile_data(user)

@router.get("/user/profile/")
async def get_user_profile(user=Depends(get_current_user)):
    """Get user profile from public.users table"""
    return await _get_user_profile_data(user)
