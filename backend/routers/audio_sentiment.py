from fastapi import APIRouter, File, UploadFile, Depends, HTTPException
from pydantic import BaseModel
import tempfile, os, uuid
from datetime import datetime

from groq_client import transcribe_with_whisper
from db import get_sentiment_from_text, save_query_to_db, get_session_context, save_standalone_query_to_db
from auth import get_current_user

router = APIRouter()

class TextSentimentRequest(BaseModel):
    text: str
    session_id: str = None
    language: str = "en"

@router.post("/text_to_sentiment/")
async def text_to_sentiment(request: TextSentimentRequest, user=Depends(get_current_user)):
    """
    Analyze sentiment from text input and save to database.
    """
    try:
        user_id = user["sub"]  # Supabase UUID from JWT
        
        if not request.text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Analyze sentiment
        sentiment_label, sentiment_score = get_sentiment_from_text(request.text)
        
        # Generate query ID
        query_id = str(uuid.uuid4())
        
        # Try to save to database if session_id is provided
        database_saved = False
        if request.session_id:
            try:
                # Get session context to determine query index
                context = get_session_context(request.session_id)
                
                query_data = {
                    "id": query_id,
                    "session_id": request.session_id,
                    "query_index": len(context),
                    "query_text": request.text,
                    "response_text": None,
                    "sentiment_score": sentiment_score,
                    "created_at": datetime.utcnow(),
                    "input_type": "text",
                    "input_file_url": None,
                    "input_audio_url": None,
                    "transcript": None,
                    "sentiment_label": sentiment_label,
                    "groq_response_main": None,
                    "groq_response_simplified": None,
                    "explanation_audio_url": None,
                    "tts_timings": None,
                    "response_language": request.language,
                    "user_id": user_id
                }
                
                save_query_to_db(query_data)
                database_saved = True
                print(f"Successfully saved query to database: {query_id}")
                
            except Exception as db_error:
                print(f"Database save failed, continuing without database: {db_error}")
                # Continue without database - this is temporary for testing
        
        return {
            "query_id": query_id,
            "text": request.text,
            "sentiment_label": sentiment_label,
            "sentiment_score": sentiment_score,
            "session_id": request.session_id,
            "language": request.language,
            "database_saved": database_saved  # For debugging
        }
        
    except Exception as e:
        print(f"Text sentiment error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze text sentiment: {str(e)}")

@router.post("/audio_to_sentiment/")
async def audio_to_sentiment(file: UploadFile = File(...), user=Depends(get_current_user)):
    user_id = user["sub"]  # Supabase UUID of logged-in user

    # Generate query ID and determine file extension
    query_id = str(uuid.uuid4())
    suffix = os.path.splitext(file.filename)[-1] or ".webm"
    local_audio_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "local_audio"))
    os.makedirs(local_audio_dir, exist_ok=True)
    local_audio_path = os.path.join(local_audio_dir, f"query_{query_id}{suffix}")

    # Save uploaded file to local_audio with new name
    try:
        with open(local_audio_path, "wb") as out_file:
            file_bytes = await file.read()
            out_file.write(file_bytes)
        print(f"[AUDIO DEBUG] Saved uploaded file to: {local_audio_path} ({len(file_bytes)} bytes)")
    except Exception as file_save_error:
        print(f"[AUDIO ERROR] Failed to save uploaded file: {file_save_error}")
        raise HTTPException(status_code=500, detail=f"Failed to save audio file: {file_save_error}")

    try:
        # Transcribe audio using Groq Whisper
        transcript = transcribe_with_whisper(local_audio_path).strip()
        print(f"[AUDIO DEBUG] Transcript: {transcript[:100]}...")

        # Analyze sentiment
        sentiment_label, sentiment_score = get_sentiment_from_text(transcript)
        print(f"[AUDIO DEBUG] Sentiment: {sentiment_label}, Score: {sentiment_score}")

        # --- Get Groq chat responses (both simplified and detailed) ---
        from groq_client import get_simplified_response, get_detailed_response
        try:
            groq_response_simplified = get_simplified_response(transcript)
            groq_response_main = get_detailed_response(transcript)
        except Exception as e:
            groq_response_simplified = f"[Groq error: {e}]"
            groq_response_main = f"[Groq error: {e}]"

        # --- Save standalone query to DB using query_id ---
        # Instead of requiring a session_id, create a standalone query entry
        database_saved = False
        try:
            # Create a standalone query entry with null session_id
            query_data = {
                "id": query_id,
                "session_id": None,  # Allow null session_id for standalone queries
                "query_index": 0,  # Default index for standalone queries
                "query_text": transcript,
                "response_text": None,
                "sentiment_score": sentiment_score,
                "created_at": datetime.utcnow(),
                "input_type": "voice",
                "input_file_url": None,
                "input_audio_url": local_audio_path,
                "transcript": transcript,
                "sentiment_label": sentiment_label,
                "groq_response_main": groq_response_main,
                "groq_response_simplified": groq_response_simplified,
                "explanation_audio_url": None,
                "tts_timings": None,
                "response_language": "en",
                "user_id": user_id
            }
            save_standalone_query_to_db(query_data)
            database_saved = True
            print(f"[AUDIO DEBUG] Successfully saved standalone query to database: {query_id}")
        except Exception as db_error:
            print(f"[AUDIO ERROR] Database save failed: {db_error}")

        return {
            "query_id": query_id,
            "transcript": transcript,
            "sentiment_label": sentiment_label,
            "sentiment_score": sentiment_score,
            "groq_response": groq_response_simplified,  # Default to simplified for backward compatibility
            "groq_response_simplified": groq_response_simplified,
            "groq_response_main": groq_response_main,
            "input_audio_path": local_audio_path,  # For debugging or reference
            "database_saved": database_saved,
            "session_id": None  # Explicitly return null since we're not using sessions for audio
        }

    finally:
        pass  # Do not delete the file; it is now stored locally
