# google_tts.py

import os
import uuid
import json
from google.oauth2 import service_account
from google.cloud import texttospeech_v1 as tts
from dotenv import load_dotenv
load_dotenv()
GOOGLE_TTS_KEY = os.getenv("GOOGLE_TTS_KEY")  # for REST (unused here)
PROJECT_ID = os.getenv("GOOGLE_TTS_PROJECT_ID")

# Optional: use service account .json if required (recommended in prod)
# credentials = service_account.Credentials.from_service_account_file("gcp-sa.json")

client = tts.TextToSpeechClient()

def synthesize_with_timings(text: str, language_code: str = "en-US", voice_name: str = "en-US-Wavenet-D"):
    input_text = tts.SynthesisInput(text=text)

    voice = tts.VoiceSelectionParams(
        language_code=language_code,
        name=voice_name
    )

    audio_config = tts.AudioConfig(
        audio_encoding=tts.AudioEncoding.MP3
        # Removing enable_time_pointing as it's not supported in the current version
    )

    # Using plain text input instead of SSML with marks
    input_text = tts.SynthesisInput(text=text)

    response = client.synthesize_speech(
        input=input_text,
        voice=voice,
        audio_config=audio_config
    )

    # Save audio using tempfile for cross-platform compatibility
    import tempfile
    
    # Create a temporary file with the correct extension
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = tmp.name
        tmp.write(response.audio_content)
    
    audio_file = tmp_path

    # Parse timing info - since enable_time_pointing is not available,
    # we'll use a simple estimation method
    sentences = text.split('.')
    sentences = [s.strip() for s in sentences if s.strip()]
    
    # Create estimated timings for frontend
    processed_timings = []
    
    # Simple estimation: calculate timings based on character count
    total_chars = len(text)
    
    # Estimate about 0.1 seconds per character (adjust based on your needs)
    total_duration = total_chars * 0.08  # Rough estimate
    
    chars_so_far = 0
    for i, sentence in enumerate(sentences):
        # Calculate start and end times based on character position
        sentence_with_period = sentence + "."
        start_time = (chars_so_far / total_chars) * total_duration if total_chars > 0 else 0
        chars_so_far += len(sentence_with_period)
        end_time = (chars_so_far / total_chars) * total_duration if total_chars > 0 else 0
        
        processed_timings.append({
            "start": start_time,
            "end": end_time,
            "text": sentence_with_period
        })

    return audio_file, processed_timings
