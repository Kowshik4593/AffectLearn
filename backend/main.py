# main.py

from routers import ask, audio_sentiment, generate_voice, user, chat, file_upload, image_generator
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import tempfile
from dotenv import load_dotenv
load_dotenv()

# Set environment variable for development mode
os.environ.setdefault("ENVIRONMENT", "development")

app = FastAPI()

# Create directories for audio storage
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
audio_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "generated_audio")
generated_images_dir = os.path.join(static_dir, "generated_images")
os.makedirs(static_dir, exist_ok=True)
os.makedirs(audio_dir, exist_ok=True)
os.makedirs(generated_images_dir, exist_ok=True)

# Mount static files directories
app.mount("/api/static", StaticFiles(directory=static_dir), name="static")
app.mount("/api/audio", StaticFiles(directory=audio_dir), name="audio")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://your-production-frontend.com",
        "*"  # Allow all origins during development (remove in production)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-Requested-With"],
    expose_headers=["Content-Length", "Date", "X-Request-ID"],
    max_age=600  # Cache preflight requests for 10 minutes
)

@app.get("/")
async def root():
    return {"message": "AffectLearn API is running!", "status": "healthy"}

app.include_router(ask.router)
app.include_router(audio_sentiment.router)  # This now includes text_to_sentiment
app.include_router(generate_voice.router)
app.include_router(user.router)
app.include_router(chat.router)  # This includes new_chat
app.include_router(file_upload.router)  # PDF and image upload endpoints
app.include_router(image_generator.router)  # Image generation endpoints
