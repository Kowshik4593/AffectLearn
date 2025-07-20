# routers/generate_voice.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid
import os
import logging
import shutil
import time
import glob

from google_tts import synthesize_with_timings
from supabase_client import upload_audio_to_supabase, AUDIO_STORAGE_DIR, STATIC_DIR
from auth import get_current_user

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("generate_voice")

router = APIRouter()

def truncate_text_to_byte_limit(text: str, max_bytes: int = 4800) -> str:
    """
    Truncate text to fit within Google TTS byte limit while preserving sentence boundaries.
    """
    text_bytes = text.encode('utf-8')
    if len(text_bytes) <= max_bytes:
        return text
    
    logger.warning(f"Text is {len(text_bytes)} bytes, which exceeds Google TTS limit. Truncating...")
    
    # Binary search to find the longest text that fits within the limit
    left, right = 0, len(text)
    best_text = text[:3000]  # fallback
    
    while left <= right:
        mid = (left + right) // 2
        test_text = text[:mid]
        
        # Try to end at a sentence boundary for better quality
        last_period = test_text.rfind('.')
        last_exclamation = test_text.rfind('!')
        last_question = test_text.rfind('?')
        sentence_end = max(last_period, last_exclamation, last_question)
        
        if sentence_end > mid - 200:  # If we found a sentence end nearby
            test_text = test_text[:sentence_end + 1]
        
        test_bytes = test_text.encode('utf-8')
        
        if len(test_bytes) <= max_bytes:
            best_text = test_text
            left = mid + 1
        else:
            right = mid - 1
    
    original_length = len(text)
    logger.warning(f"Text truncated from {original_length} to {len(best_text)} characters ({len(best_text.encode('utf-8'))} bytes)")
    return best_text

class VoiceRequest(BaseModel):
    text: str
    language_code: str = "en-US"  # can be 'hi-IN', 'ta-IN', etc.
    voice_name: str = "en-US-Wavenet-D"  # Optional voice selection
    session_id: str = None  # Optional session ID for organization
    query_id: str = None  # Optional query ID for easy retrieval
    chat_id: str = None  # Optional chat ID for organization

@router.post("/voice/generate")
async def generate_voice(data: VoiceRequest, user=Depends(get_current_user)):
    """
    Generate voice audio from text using Google TTS and save to local storage.
    Returns the audio URL and timing data for frontend synchronization.
    """
    try:
        user_id = user["sub"]  # Supabase UUID of logged-in user
        
        logger.info(f"Generating voice for user {user_id}")
        logger.info(f"Text length: {len(data.text)} characters")
        logger.info(f"Language: {data.language_code}, Voice: {data.voice_name}")
        
        # Validate input
        if not data.text or len(data.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Truncate text if it exceeds Google TTS byte limit
        data.text = truncate_text_to_byte_limit(data.text)
        
        # 1. Generate TTS audio and timings
        try:
            audio_path, timings = synthesize_with_timings(
                data.text, 
                language_code=data.language_code,
                voice_name=data.voice_name
            )
            logger.info(f"Successfully generated audio at: {audio_path}")
            logger.info(f"Generated {len(timings)} timing segments")
        except Exception as tts_error:
            logger.error(f"TTS generation failed: {tts_error}")
            raise HTTPException(status_code=500, detail=f"Voice generation failed: {str(tts_error)}")
        
        # 2. Save audio file and get URL
        try:
            file_id = str(uuid.uuid4())
            
            # Create organized path with session/query IDs if provided
            if data.query_id:
                if data.session_id:
                    target_path = f"voice_explanations/{user_id}/session_{data.session_id}/query_{data.query_id}_{file_id}.mp3"
                else:
                    target_path = f"voice_explanations/{user_id}/query_{data.query_id}_{file_id}.mp3"
            elif data.session_id:
                target_path = f"voice_explanations/{user_id}/session_{data.session_id}/{file_id}.mp3"
            else:
                target_path = f"voice_explanations/{user_id}/{file_id}.mp3"
            
            audio_url = upload_audio_to_supabase(audio_path, target_path)
            logger.info(f"Audio saved successfully. URL: {audio_url}")
        except Exception as upload_error:
            logger.error(f"Error saving audio file: {upload_error}")
            raise HTTPException(status_code=500, detail=f"Failed to save audio: {str(upload_error)}")
        
        # 3. Clean up temporary file
        try:
            if os.path.exists(audio_path):
                os.remove(audio_path)
                logger.info("Temporary file cleaned up")
        except Exception as cleanup_error:
            logger.warning(f"Failed to clean up temp file: {cleanup_error}")

        # 4. Return response
        response = {
            "success": True,
            "audio_url": audio_url,
            "timings": timings,
            "metadata": {
                "text_length": len(data.text),
                "language_code": data.language_code,
                "voice_name": data.voice_name,
                "segments_count": len(timings)
            }
        }
        
        logger.info("Voice generation completed successfully")
        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in voice generation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error during voice generation")

# Add a test endpoint without authentication for development
@router.post("/voice/generate-test")
async def generate_voice_test(data: VoiceRequest):
    """
    Test endpoint for voice generation without authentication (development only)
    """
    try:
        logger.info("Testing voice generation without authentication")
        logger.info(f"Text length: {len(data.text)} characters")
        logger.info(f"Language: {data.language_code}, Voice: {data.voice_name}")
        
        # Validate input
        if not data.text or len(data.text.strip()) == 0:
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        # Truncate text if it exceeds Google TTS byte limit
        data.text = truncate_text_to_byte_limit(data.text)
        
        # 1. Generate TTS audio and timings
        try:
            audio_path, timings = synthesize_with_timings(
                data.text, 
                language_code=data.language_code,
                voice_name=data.voice_name
            )
            logger.info(f"Successfully generated audio at: {audio_path}")
            logger.info(f"Generated {len(timings)} timing segments")
        except Exception as tts_error:
            logger.error(f"TTS generation failed: {tts_error}")
            raise HTTPException(status_code=500, detail=f"Voice generation failed: {str(tts_error)}")
        
        # 2. Save audio file and get URL
        try:
            file_id = str(uuid.uuid4())
            target_path = f"voice_test/{file_id}.mp3"
            
            audio_url = upload_audio_to_supabase(audio_path, target_path)
            logger.info(f"Audio saved successfully. URL: {audio_url}")
        except Exception as upload_error:
            logger.error(f"Error saving audio file: {upload_error}")
            raise HTTPException(status_code=500, detail=f"Failed to save audio: {str(upload_error)}")
        
        # 3. Clean up temporary file
        try:
            if os.path.exists(audio_path):
                os.remove(audio_path)
                logger.info("Temporary file cleaned up")
        except Exception as cleanup_error:
            logger.warning(f"Failed to clean up temp file: {cleanup_error}")

        # 4. Return response
        response = {
            "success": True,
            "audio_url": audio_url,
            "timings": timings,
            "metadata": {
                "text_length": len(data.text),
                "language_code": data.language_code,
                "voice_name": data.voice_name,
                "segments_count": len(timings)
            }
        }
        
        logger.info("Voice generation completed successfully")
        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in voice generation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error during voice generation")

@router.get("/voice/audio")
async def get_audio_by_query_id(query_id: str, session_id: str = None, user=Depends(get_current_user)):
    """
    Retrieve audio file by query ID for easy access to previously generated explanations.
    """
    try:
        user_id = user["sub"]
        logger.info(f"Retrieving audio for query_id: {query_id}, session_id: {session_id}, user: {user_id}")
        
        # Search for the audio file in the organized directory structure
        base_search_dir = os.path.join(AUDIO_STORAGE_DIR, f"voice_explanations/{user_id}")
        
        if not os.path.exists(base_search_dir):
            raise HTTPException(status_code=404, detail="No audio files found for this user")
        
        # Search patterns based on available information
        search_patterns = []
        
        if session_id:
            # Look in session-specific directory first
            session_dir = os.path.join(base_search_dir, f"session_{session_id}")
            if os.path.exists(session_dir):
                search_patterns.append(os.path.join(session_dir, f"query_{query_id}_*.mp3"))
        
        # Also search in general user directory
        search_patterns.append(os.path.join(base_search_dir, f"query_{query_id}_*.mp3"))
        
        # Search for all possible subdirectories
        search_patterns.append(os.path.join(base_search_dir, "**", f"query_{query_id}_*.mp3"))
        
        found_files = []
        
        for pattern in search_patterns:
            matches = glob.glob(pattern, recursive=True)
            found_files.extend(matches)
        
        if not found_files:
            raise HTTPException(status_code=404, detail=f"Audio file not found for query_id: {query_id}")
        
        # Get the most recent file if multiple matches
        audio_file = max(found_files, key=lambda f: os.path.getmtime(f))
        
        # Create a temporary static file for serving
        static_filename = f"retrieved_{int(time.time())}_{os.path.basename(audio_file)}"
        static_path = os.path.join(STATIC_DIR, static_filename)
        
        # Copy to static directory for serving
        shutil.copy(audio_file, static_path)
        
        audio_url = f"/api/static/{static_filename}"
        
        logger.info(f"Found audio file: {audio_file}")
        logger.info(f"Serving via: {audio_url}")
        
        return {
            "success": True,
            "audio_url": audio_url,
            "query_id": query_id,
            "session_id": session_id,
            "file_path": audio_file,
            "metadata": {
                "file_size": os.path.getsize(audio_file),
                "created_time": os.path.getmtime(audio_file)
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving audio: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error retrieving audio file")
