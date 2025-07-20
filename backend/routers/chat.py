# routers/chat.py

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime
import uuid

from auth import get_current_user
from db import get_db_connection

router = APIRouter()

class NewChatRequest(BaseModel):
    user_id: str = None  # Optional, will use JWT user if not provided

class UpdateChatTitleRequest(BaseModel):
    title: str

@router.post("/new_chat/")
async def create_new_chat(request: NewChatRequest = None, user=Depends(get_current_user)):
    """
    Create a new chat session for the user.
    """
    try:
        user_id = user["sub"]  # Always use the authenticated user's ID
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Create a new chat
            chat_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO chats (id, user_id, title, created_at, last_active)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (
                chat_id,
                user_id,
                "New Chat",
                datetime.utcnow(),
                datetime.utcnow()
            ))
            
            # Create an initial session for this chat
            session_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO sessions (id, chat_id, user_id, started_at)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (
                session_id,
                chat_id,
                user_id,
                datetime.utcnow()
            ))
            
            return {
                "chat_id": chat_id,
                "session_id": session_id,
                "title": "New Chat",
                "created_at": datetime.utcnow().isoformat()
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create chat: {str(e)}")

@router.put("/chat/{chat_id}/title")
async def update_chat_title(chat_id: str, request: UpdateChatTitleRequest, user=Depends(get_current_user)):
    """Update the title of a chat"""
    try:
        user_id = user["sub"]
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Verify chat belongs to user
            cur.execute("SELECT id FROM chats WHERE id = %s AND user_id = %s", (chat_id, user_id))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Chat not found")
            
            # Update the title
            cur.execute("""
                UPDATE chats 
                SET title = %s, last_active = %s
                WHERE id = %s AND user_id = %s
                RETURNING id, title
            """, (request.title, datetime.utcnow(), chat_id, user_id))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Chat not found")
            
            return {
                "chat_id": result[0],
                "title": result[1],
                "updated_at": datetime.utcnow().isoformat()
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update chat title: {str(e)}")

@router.get("/chat/{chat_id}")
async def get_chat_with_messages(chat_id: str, user=Depends(get_current_user)):
    """Get a specific chat with all its messages"""
    try:
        user_id = user["sub"]
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Get the chat
            cur.execute("""
                SELECT id, title, created_at, last_active
                FROM chats 
                WHERE id = %s AND user_id = %s
            """, (chat_id, user_id))
            
            chat_row = cur.fetchone()
            if not chat_row:
                raise HTTPException(status_code=404, detail="Chat not found")
            
            # Get all queries/messages for this chat
            cur.execute("""
                SELECT q.id, q.query_text, q.groq_response_simplified, q.groq_response_main, 
                       q.sentiment_label, q.sentiment_score, q.input_type, 
                       q.created_at, q.session_id
                FROM queries q
                JOIN sessions s ON q.session_id = s.id
                WHERE s.chat_id = %s
                ORDER BY q.created_at ASC
            """, (chat_id,))
            
            messages = []
            for row in cur.fetchall():
                # Add user message
                messages.append({
                    "id": f"user_{row[0]}",
                    "type": "user",
                    "content": row[1],
                    "timestamp": row[7],
                    "sentiment": row[4],
                    "query_id": row[0]
                })
                
                # Add assistant message if there's a response
                simple_response = row[2]  # q.groq_response_simplified
                detailed_response = row[3]  # q.groq_response_main
                
                # Use detailed response as main content in chat, with simple as fallback
                main_content = detailed_response or simple_response
                if main_content:
                    messages.append({
                        "id": f"assistant_{row[0]}",
                        "type": "assistant", 
                        "content": main_content,  # Detailed response as main content
                        "timestamp": row[7],
                        "query_id": row[0],
                        "main_response": detailed_response,
                        "simplified_response": simple_response,
                        "detailed_response": detailed_response  # For voice explanations
                    })
            
            return {
                "id": chat_row[0],
                "title": chat_row[1],
                "created_at": chat_row[2],
                "last_active": chat_row[3],
                "messages": messages
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chat: {str(e)}")

@router.get("/chats/")
async def get_user_chats(user=Depends(get_current_user)):
    """Get all chats for the authenticated user"""
    try:
        user_id = user["sub"]
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Simplified query to avoid timeouts - just get basic chat info
            cur.execute("""
                SELECT id, title, created_at, last_active
                FROM chats 
                WHERE user_id = %s
                ORDER BY last_active DESC
            """, (user_id,))
            
            chats = []
            for row in cur.fetchall():
                chats.append({
                    "id": row[0],
                    "title": row[1],
                    "created_at": row[2],
                    "last_active": row[3],
                    "session_count": 0,  # We can add this back later if needed
                    "last_message": None  # We can add this back later if needed
                })
            
            return {"chats": chats}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get chats: {str(e)}")

@router.get("/chat/{chat_id}/sessions")
async def get_chat_sessions(chat_id: str, user=Depends(get_current_user)):
    """Get all sessions for a specific chat"""
    try:
        user_id = user["sub"]
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Verify chat belongs to user
            cur.execute("SELECT id FROM chats WHERE id = %s AND user_id = %s", (chat_id, user_id))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Chat not found")
            
            # Get sessions
            cur.execute("""
                SELECT s.id, s.started_at, s.ended_at, s.user_selected_difficulty,
                       COUNT(q.id) as query_count
                FROM sessions s
                LEFT JOIN queries q ON s.id = q.session_id
                WHERE s.chat_id = %s
                GROUP BY s.id, s.started_at, s.ended_at, s.user_selected_difficulty
                ORDER BY s.started_at DESC
            """, (chat_id,))
            
            sessions = []
            for row in cur.fetchall():
                sessions.append({
                    "id": row[0],
                    "started_at": row[1],
                    "ended_at": row[2],
                    "difficulty": row[3],
                    "query_count": row[4]
                })
            
            return {"sessions": sessions}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get sessions: {str(e)}")

@router.delete("/chat/{chat_id}")
async def delete_chat(chat_id: str, user=Depends(get_current_user)):
    """Delete a chat and all its associated data"""
    try:
        user_id = user["sub"]
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Verify chat belongs to user
            cur.execute("SELECT id FROM chats WHERE id = %s AND user_id = %s", (chat_id, user_id))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Chat not found")
            
            # Delete queries first (due to foreign key constraints)
            cur.execute("""
                DELETE FROM queries 
                WHERE session_id IN (
                    SELECT id FROM sessions WHERE chat_id = %s
                )
            """, (chat_id,))
            
            # Delete sessions
            cur.execute("DELETE FROM sessions WHERE chat_id = %s", (chat_id,))
            
            # Delete the chat
            cur.execute("DELETE FROM chats WHERE id = %s AND user_id = %s", (chat_id, user_id))
            
            return {"message": "Chat deleted successfully", "chat_id": chat_id}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete chat: {str(e)}")
