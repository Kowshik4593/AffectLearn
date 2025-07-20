# routers/ask.py

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from uuid import uuid4
from datetime import datetime
import uuid

from groq_client import (
    get_groq_response, 
    get_simplified_response, 
    get_detailed_response, 
    get_voice_explanation_response
)
from db import save_query_to_db, get_session_context
from auth import get_current_user
from .image_generator import get_image_for_query

router = APIRouter()

class AskRequest(BaseModel):
    session_id: str
    chat_id: str
    query_text: str
    input_type: str  # text, voice, pdf, image
    transcript: str = None
    sentiment_label: str  # POSITIVE, NEUTRAL, NEGATIVE
    sentiment_score: float
    language: str = "en"

@router.post("/ask/")
async def ask_groq(request: AskRequest, user=Depends(get_current_user)):
    try:
        user_id = user["sub"]  # Supabase UUID of logged-in user
        
        # Get previous queries in the session
        context = get_session_context(request.session_id)
        context_str = "\n".join(context)

        # Simple Groq-only pipeline 
        full_prompt = f"""You are a friendly, emotionally intelligent STEM tutor.
The student is feeling {request.sentiment_label.lower()}.

{context_str}

Now answer this:
Q: {request.query_text}
"""
        
        # Get simple and detailed responses from Groq
        try:
            groq_simple = get_simplified_response(full_prompt)
            groq_main = get_detailed_response(full_prompt)
        except Exception as e:
            groq_main = get_groq_response(full_prompt)
            groq_simple = get_groq_response(f"Explain this briefly in 2-3 sentences:\n{groq_main}")

        # Save query to DB
        query_id = str(uuid4())
        
        # Get image for the query
        try:
            image_data = get_image_for_query(request.query_text, query_id)
        except Exception as e:
            # If image generation fails, continue without image
            image_data = {
                "image_url": None,
                "image_type": None,
                "svg_code": None,
                "explanations": []
            }
        
        save_query_to_db({
            "id": query_id,
            "session_id": request.session_id,
            "query_index": len(context),
            "query_text": request.query_text,
            "input_type": request.input_type,
            "transcript": request.transcript,
            "sentiment_label": request.sentiment_label,
            "sentiment_score": request.sentiment_score,
            "tinyllama_response": None,  # No TinyLlama response
            "groq_response_main": groq_main,
            "groq_response_simplified": groq_simple,
            "response_language": request.language,
            "user_id": user_id,
            "created_at": datetime.utcnow()
        })

        response_data = {
            "query_id": query_id,
            "main_response": groq_simple,  # Simple response as main for chat display
            "simplified_response": groq_simple,  # Simple response
            "detailed_response": groq_main,  # Detailed response for voice
            "image_data": image_data  # Include image data
        }
        
        response_data["pipeline"] = "Groq only"

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/ask/voice-explanation")
async def get_voice_explanation(request: AskRequest, user=Depends(get_current_user)):
    """
    Generate a comprehensive voice explanation for a query using Groq.
    This provides detailed content specifically optimized for audio learning.
    """
    try:
        user_id = user["sub"]
        
        # Get previous queries in the session for context
        context = get_session_context(request.session_id)
        context_str = "\n".join(context)

        # Simple Groq voice explanation
        full_prompt = f"""You are a comprehensive STEM tutor providing detailed voice explanations.
The student is feeling {request.sentiment_label.lower()}.

Previous conversation context:
{context_str}

Now provide a thorough explanation for:
Q: {request.query_text}
"""
        try:
            voice_explanation = get_voice_explanation_response(full_prompt)
        except Exception as e:
            voice_explanation = get_detailed_response(full_prompt)

        # Get image for the query (for voice explanation as well)
        try:
            image_data = get_image_for_query(request.query_text)
        except Exception as e:
            image_data = {
                "image_url": None,
                "image_type": None,
                "svg_code": None,
                "explanations": []
            }

        response_data = {
            "voice_explanation": voice_explanation,
            "query_text": request.query_text,
            "sentiment": request.sentiment_label,
            "pipeline": "Groq only (Voice)",
            "image_data": image_data
        }

        return response_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
