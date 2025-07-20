# supabase_client.py

import os
import uuid
import shutil
import logging
import time
from pathlib import Path
from supabase import create_client
from dotenv import load_dotenv
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("supabase_client")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", SUPABASE_KEY)  # Fallback to regular key if not specified

# Add environment variable to force fallback mode (useful when RLS is causing issues)
USE_FALLBACK = os.getenv("USE_SUPABASE_FALLBACK", "false").lower() in ("true", "1", "yes")
if USE_FALLBACK:
    logger.info("Supabase fallback mode is ENABLED. All uploads will use local static file storage.")

# Check if we have service role key (recommended for bypassing RLS)
is_service_key = SUPABASE_KEY and len(SUPABASE_KEY) > 100  # Service keys are typically longer
if not is_service_key:
    logger.warning("Warning: You appear to be using an anon key, not a service role key.")
    logger.warning("This may cause RLS permission issues with uploads.")
    logger.warning("Consider using a service role key or updating your RLS policies.")

# Initialize client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Default bucket names (can override if needed)
DEFAULT_AUDIO_BUCKET = os.getenv("SUPABASE_BUCKET_AUDIO", "audio-files")
DEFAULT_UPLOAD_BUCKET = os.getenv("SUPABASE_BUCKET_UPLOADS", "user-uploads")

# Create audio storage directory in the root folder (parent of chat-backend)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # Go up two levels to root
AUDIO_STORAGE_DIR = os.path.join(ROOT_DIR, "generated_audio")
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Create both directories
os.makedirs(AUDIO_STORAGE_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

logger.info(f"Audio storage directory: {AUDIO_STORAGE_DIR}")
logger.info(f"Static fallback directory: {STATIC_DIR}")

def upload_audio_to_supabase(file_path: str, target_path: str, bucket: str = DEFAULT_AUDIO_BUCKET) -> str:
    """
    Saves audio files to a local directory and returns the public URL.
    This version prioritizes local storage for reliability and creates organized directory structures.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")
        
    logger.info(f"Processing audio file: {file_path}")
    logger.info(f"Target path: {target_path}")
    
    # Parse the target path to create organized directory structure
    path_parts = target_path.split('/')
    filename = path_parts[-1]  # Last part is the filename
    subdirs = path_parts[:-1]  # Everything except the filename
    
    # Create organized directory structure in audio storage
    organized_dir = AUDIO_STORAGE_DIR
    for subdir in subdirs:
        organized_dir = os.path.join(organized_dir, subdir)
    
    # Ensure the organized directory exists
    os.makedirs(organized_dir, exist_ok=True)
    
    # Full path for the organized file
    organized_file_path = os.path.join(organized_dir, filename)
    
    # Generate a unique filename for API serving (keeping it simple for API)
    base, ext = os.path.splitext(filename)
    unique_id = str(int(uuid.uuid4().int % 1000000000))
    timestamp = str(int(time.time()))
    
    # Create a simple filename for API serving
    api_filename = f"audio_{timestamp}_{unique_id}{ext}"
    static_path = os.path.join(STATIC_DIR, api_filename)
    
    # Copy the file to both locations
    try:
        # Save to organized directory (permanent storage)
        shutil.copy(file_path, organized_file_path)
        logger.info(f"Audio file saved to organized location: {organized_file_path}")
        
        # Also copy to static directory for serving via API
        shutil.copy(file_path, static_path)
        
        # Return the API URL for serving the file
        public_url = f"/api/static/{api_filename}"
        logger.info(f"Audio file accessible at: {public_url}")
        logger.info(f"Organized file location: {organized_file_path}")
        
        return public_url
        
    except Exception as e:
        logger.error(f"Error saving audio file: {e}")
        raise e


def upload_pdf_or_image(file_path: str, file_type: str = "pdf") -> str:
    """
    Uploads a PDF or image to the user-uploads bucket.
    `file_type` should be "pdf" or "image"
    """
    file_id = os.path.basename(file_path)
    folder = "pdfs" if file_type == "pdf" else "images"
    target_path = f"{folder}/{file_id}"

    with open(file_path, 'rb') as f:
        supabase.storage.from_(DEFAULT_UPLOAD_BUCKET).upload(path=target_path, file=f)

    return supabase.storage.from_(DEFAULT_UPLOAD_BUCKET).get_public_url(target_path)
