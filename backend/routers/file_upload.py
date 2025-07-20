# routers/file_upload.py

from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, Form
from pydantic import BaseModel
import os
import tempfile
import uuid
from datetime import datetime

from auth import get_current_user
from db import get_db_connection
from supabase_client import upload_pdf_or_image

router = APIRouter()

class FileUploadResponse(BaseModel):
    file_url: str
    extracted_text: str
    file_type: str
    session_id: str

@router.post("/parse_pdf/", response_model=FileUploadResponse)
async def parse_pdf(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    user=Depends(get_current_user)
):
    """
    Upload and parse a PDF file, extracting text content.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        user_id = user["sub"]
        
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            # Upload to Supabase
            file_url = upload_pdf_or_image(tmp_path, "pdf")
            
            # Extract text from PDF (you'll need to implement this)
            extracted_text = extract_text_from_pdf(tmp_path)
            
            # Save to database
            conn = get_db_connection()
            with conn.cursor() as cur:
                query_id = str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO user_queries (id, user_id, session_id, query_text, query_type, file_url, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    query_id,
                    user_id,
                    session_id,
                    extracted_text,
                    'pdf_upload',
                    file_url,
                    datetime.utcnow()
                ))
            
            return FileUploadResponse(
                file_url=file_url,
                extracted_text=extracted_text,
                file_type="pdf",
                session_id=session_id
            )
            
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@router.post("/parse_image/", response_model=FileUploadResponse)
async def parse_image(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    user=Depends(get_current_user)
):
    """
    Upload and parse an image file, extracting text content via OCR.
    """
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp']
    if not any(file.filename.lower().endswith(ext) for ext in allowed_extensions):
        raise HTTPException(status_code=400, detail="File must be an image (jpg, png, etc.)")
    
    try:
        user_id = user["sub"]
        
        # Save file temporarily
        file_extension = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            # Upload to Supabase
            file_url = upload_pdf_or_image(tmp_path, "image")
            
            # Extract text from image via OCR (you'll need to implement this)
            extracted_text = extract_text_from_image(tmp_path)
            
            # Save to database
            conn = get_db_connection()
            with conn.cursor() as cur:
                query_id = str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO user_queries (id, user_id, session_id, query_text, query_type, file_url, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    query_id,
                    user_id,
                    session_id,
                    extracted_text,
                    'image_upload',
                    file_url,
                    datetime.utcnow()
                ))
            
            return FileUploadResponse(
                file_url=file_url,
                extracted_text=extracted_text,
                file_type="image",
                session_id=session_id
            )
            
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

def extract_text_from_pdf(file_path: str) -> str:
    """
    Extract text from PDF file.
    TODO: Implement PDF text extraction (e.g., using PyPDF2 or pdfplumber)
    """
    # Placeholder implementation
    return f"[PDF content extracted from {os.path.basename(file_path)}]"

def extract_text_from_image(file_path: str) -> str:
    """
    Extract text from image using OCR.
    TODO: Implement OCR (e.g., using Tesseract/pytesseract or Google Vision API)
    """
    # Placeholder implementation
    return f"[OCR text extracted from {os.path.basename(file_path)}]"
