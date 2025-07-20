# routers/image_generator.py

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
import os
import json
import uuid
from pathlib import Path
from sentence_transformers import SentenceTransformer
import re
import svgwrite
import logging
from auth import get_current_user

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/image", tags=["image_generation"])

# Define paths
BASE_DIR = Path(__file__).parent.parent  # chat-backend directory
IMG_RAG_DIR = BASE_DIR / "img_generator_rag"
IMAGES_DIR = BASE_DIR / "static" / "generated_images"
TEXTBOOK_IMAGES_DIR = IMG_RAG_DIR / "textbooks" / "images"

# Create directories if they don't exist
os.makedirs(IMAGES_DIR, exist_ok=True)

# Global variables for lazy loading
image_metadata = []
model = None

def initialize_image_service():
    """Initialize the image generation service components"""
    global image_metadata, model
    
    try:
        # Load sentence transformer
        model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("SentenceTransformer model loaded successfully")
        
        # Load topic-based images from static/generated_images folder
        image_metadata = []
        if IMAGES_DIR.exists():
            for img_file in IMAGES_DIR.glob("*"):
                if img_file.suffix.lower() in ['.png', '.jpg', '.jpeg', '.gif', '.bmp']:
                    # Extract topic from filename (remove extension)
                    topic = img_file.stem.lower()
                    image_metadata.append({
                        "image_path": img_file.name,
                        "topic": topic,
                        "full_path": str(img_file)
                    })
        
        # Also check textbook images as fallback
        if TEXTBOOK_IMAGES_DIR.exists():
            for img_file in TEXTBOOK_IMAGES_DIR.glob("*.png"):
                image_metadata.append({
                    "image_path": img_file.name,
                    "topic": "general",
                    "full_path": str(img_file),
                    "source": "textbook"
                })
        logger.info(f"Found {len(image_metadata)} images total")
        
    except Exception as e:
        logger.error(f"Error initializing image service: {str(e)}")
        model = None
        image_metadata = []

def generate_svg(query: str) -> str:
    """Generate SVG for specific STEM topics based on query."""
    dwg = svgwrite.Drawing(size=("200px", "200px"))
    query_lower = query.lower()
    
    # Math: Quadratic Equation
    if "quadratic" in query_lower:
        dwg.add(dwg.line((0, 100), (200, 100), stroke="black"))  # x-axis
        dwg.add(dwg.line((100, 0), (100, 200), stroke="black"))  # y-axis
        
        path_data = "M"
        for x in range(0, 201, 5):
            scaled_x = (x - 100) / 20
            y = scaled_x**2 - 2*scaled_x - 3
            scaled_y = 100 - (y * 10)
            if scaled_y < 0: scaled_y = 0
            if scaled_y > 200: scaled_y = 200
            
            if x == 0:
                path_data += f"{x},{scaled_y}"
            else:
                path_data += f" L{x},{scaled_y}"
        
        dwg.add(dwg.path(d=path_data, stroke="blue", fill="none", stroke_width=2))
        dwg.add(dwg.text("y = x² - 2x - 3", insert=(10, 20), font_size="12", fill="blue"))
        return dwg.tostring()
    
    # Deep Learning
    if "deep learning" in query_lower:
        # Neural network
        dwg.add(dwg.circle((50, 50), 8, fill="lightblue", stroke="blue"))
        dwg.add(dwg.circle((50, 100), 8, fill="lightblue", stroke="blue"))
        dwg.add(dwg.circle((50, 150), 8, fill="lightblue", stroke="blue"))
        
        dwg.add(dwg.circle((100, 40), 8, fill="lightgreen", stroke="green"))
        dwg.add(dwg.circle((100, 80), 8, fill="lightgreen", stroke="green"))
        dwg.add(dwg.circle((100, 120), 8, fill="lightgreen", stroke="green"))
        dwg.add(dwg.circle((100, 160), 8, fill="lightgreen", stroke="green"))
        
        dwg.add(dwg.circle((150, 60), 8, fill="lightgreen", stroke="green"))
        dwg.add(dwg.circle((150, 100), 8, fill="lightgreen", stroke="green"))
        dwg.add(dwg.circle((150, 140), 8, fill="lightgreen", stroke="green"))
        
        dwg.add(dwg.circle((190, 100), 8, fill="orange", stroke="red"))
        
        # Add connections
        connections = [
            ((50, 50), (100, 40)), ((50, 50), (100, 80)), ((50, 100), (100, 120)),
            ((100, 40), (150, 60)), ((100, 80), (150, 100)), ((150, 100), (190, 100))
        ]
        for (x1, y1), (x2, y2) in connections:
            dwg.add(dwg.line((x1, y1), (x2, y2), stroke="gray", stroke_width=1))
        
        dwg.add(dwg.text("Deep Learning", insert=(60, 20), font_size="12", fill="blue"))
        return dwg.tostring()
    
    return ""

def save_svg_locally(svg_content: str, query: str, query_id: str) -> str:
    """Save SVG content to a local file"""
    file_name = f"{query_id}_{query.replace(' ', '_')}.svg".replace("/", "_")
    file_path = IMAGES_DIR / file_name
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(svg_content)
        logger.info(f"Saved SVG locally at {file_path}")
        return f"/api/static/generated_images/{file_name}"
    except Exception as e:
        logger.error(f"Exception saving SVG locally: {str(e)}")
        return ""

def save_textbook_image_locally(image_path: str, query: str, query_id: str) -> str:
    """Copy a textbook image to the static folder"""
    source_path = TEXTBOOK_IMAGES_DIR / image_path
    
    if not source_path.exists():
        logger.error(f"Textbook image not found: {source_path}")
        return ""
    
    file_name = f"{query_id}_{Path(image_path).stem}.png"
    dest_path = IMAGES_DIR / file_name
    
    try:
        with open(source_path, "rb") as source_file, open(dest_path, "wb") as dest_file:
            dest_file.write(source_file.read())
        logger.info(f"Saved textbook image locally at {dest_path}")
        return f"/api/static/generated_images/{file_name}"
    except Exception as e:
        logger.error(f"Exception saving textbook image locally: {str(e)}")
        return ""

def get_topic_keywords(query: str) -> set:
    """Extract relevant topic keywords from query"""
    query_lower = query.lower()
    
    # Define topic mappings
    topic_mappings = {
        'deeplearning': ['deep learning', 'neural network', 'ai', 'artificial intelligence', 'machine learning', 'ml', 'dl'],
        'friction': ['friction', 'force', 'physics', 'mechanics', 'resistance'],
        'hyperbola': ['hyperbola', 'conic section', 'math', 'mathematics', 'geometry', 'curve'],
        'parabola': ['parabola', 'quadratic', 'conic section', 'math', 'mathematics', 'geometry', 'curve'],
        'photosynthesis': ['photosynthesis', 'plant', 'biology', 'chlorophyll', 'light reaction', 'dark reaction']
    }
    
    # Only extract topic-specific keywords, not all words
    keywords = set()
    
    # Add topic-specific keywords based on synonyms
    for topic, synonyms in topic_mappings.items():
        for synonym in synonyms:
            # Use word boundary matching to avoid partial matches like "ai" in "explain"
            if len(synonym.split()) == 1:
                # Single word synonym - use word boundaries
                pattern = r'\b' + re.escape(synonym) + r'\b'
                if re.search(pattern, query_lower):
                    keywords.add(topic)
                    break
            else:
                # Multi-word synonym - use exact phrase matching
                if synonym in query_lower:
                    keywords.add(topic)
                    break
    
    # Also add direct word matches for topic names
    words = re.findall(r'\w+', query_lower)
    for word in words:
        if word in topic_mappings:
            keywords.add(word)
    
    return keywords

def get_image_for_query(query: str, query_id: str = None) -> dict:
    """Get an image (topic-based, SVG or textbook) for a given query"""
    if not query_id:
        query_id = str(uuid.uuid4())
    
    # Initialize service if not already done
    if model is None:
        initialize_image_service()
    
    result = {
        "image_url": None,
        "image_type": None,
        "svg_code": None,
        "explanations": []
    }
    
    try:
        # First priority: Check for topic-based images in static folder
        query_keywords = get_topic_keywords(query)
        
        # Look for topic-based images first
        if image_metadata:
            # First, try exact topic matches
            exact_matches = []
            for meta in image_metadata:
                topic = meta["topic"]
                if topic in query_keywords:
                    exact_matches.append(meta)
            
            # If we have exact matches, use the first one
            if exact_matches:
                meta = exact_matches[0]
                topic = meta["topic"]
                if meta.get("source") != "textbook":  # Prioritize static folder images
                    image_url = f"/api/static/generated_images/{meta['image_path']}"
                    result["image_url"] = image_url
                    result["image_type"] = "topic_image"
                    logger.info(f"Found topic-based image '{meta['image_path']}' for query: {query}")
                    
                    # Add explanation for the topic
                    result["explanations"] = [{
                        "text": f"This image illustrates the concept of {topic.replace('_', ' ').title()}. {query}",
                        "pdf_name": "Topic Reference",
                        "page_num": 1
                    }]
                    return result
        
        # Second priority: Try to generate SVG for specific topics
        svg_code = generate_svg(query)
        if svg_code:
            image_url = save_svg_locally(svg_code, query, query_id)
            result["image_url"] = image_url
            result["image_type"] = "svg"
            result["svg_code"] = svg_code
            logger.info(f"Generated SVG for query: {query}")
            return result
        
        # Third priority: Try to find a textbook image as fallback
        if image_metadata:
            query_lower = query.lower()  # Define query_lower here
            for meta in image_metadata:
                if meta.get("source") == "textbook":
                    image_path = meta["image_path"]
                    if any(keyword in query_lower for keyword in ["chemistry", "math", "physics", "biology"]):
                        copied_url = save_textbook_image_locally(image_path, query, query_id)
                        if copied_url:
                            result["image_url"] = copied_url
                            result["image_type"] = "textbook"
                            logger.info(f"Found textbook image for query: {query}")
                            break
        
        # Add default explanation if no specific topic image found
        if not result["explanations"]:
            result["explanations"] = [{
                "text": f"This is an explanation about {query}. The system provides detailed information about this topic.",
                "pdf_name": "Reference Material",
                "page_num": 1
            }]
        
    except Exception as e:
        logger.error(f"Error getting image for query '{query}': {str(e)}")
    
    return result

class ImageRequest(BaseModel):
    query: str
    query_id: str = None

@router.post("/generate-image")
async def generate_image_endpoint(request: ImageRequest, user=Depends(get_current_user)):
    """Generate an image for a given query"""
    try:
        result = get_image_for_query(request.query, request.query_id)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Error in generate-image endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/explain-topic")
async def explain_topic(query: str, query_id: str = None, format: str = "json"):
    """Generate image explanation for a given query"""
    try:
        if not query_id:
            query_id = str(uuid.uuid4())
            
        result = get_image_for_query(query, query_id)
        
        response_data = {
            "query": query,
            "query_id": query_id,
            "explanations": result["explanations"],
            "image_url": result["image_url"],
            "svg_code": result["svg_code"],
            "debug": {
                "svg_generated": bool(result["svg_code"]),
                "explanations_count": len(result["explanations"])
            }
        }
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"Error in explain_topic: {e}")
        return JSONResponse(
            content={"error": f"Server error: {str(e)}"}, 
            status_code=500
        )

@router.get("/debug-images")
async def debug_images():
    """Debug endpoint to show available images and their topics"""
    try:
        if model is None:
            initialize_image_service()
        
        return JSONResponse(content={
            "available_images": image_metadata,
            "image_count": len(image_metadata),
            "images_directory": str(IMAGES_DIR)
        })
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)}, 
            status_code=500
        )

@router.get("/test-topic-match")
async def test_topic_match(query: str):
    """Test endpoint to check topic keyword matching"""
    try:
        keywords = get_topic_keywords(query)
        matches = []
        
        if model is None:
            initialize_image_service()
            
        for meta in image_metadata:
            topic = meta["topic"]
            if topic in keywords or any(keyword in topic for keyword in keywords):
                matches.append({
                    "image": meta["image_path"],
                    "topic": topic,
                    "matched": True
                })
        
        return JSONResponse(content={
            "query": query,
            "extracted_keywords": list(keywords),
            "matches": matches,
            "match_count": len(matches)
        })
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)}, 
            status_code=500
        )

@router.get("/health")
async def image_service_health():
    """Health check for image generation service"""
    try:
        if model is None:
            initialize_image_service()
        
        # Get topic images count
        topic_images = [img for img in image_metadata if img.get("source") != "textbook"]
        textbook_images = [img for img in image_metadata if img.get("source") == "textbook"]
        
        status = {
            "status": "healthy",
            "model_loaded": model is not None,
            "total_images": len(image_metadata),
            "topic_images_count": len(topic_images),
            "textbook_images_count": len(textbook_images),
            "topic_images": [img["image_path"] for img in topic_images],
            "images_directory": str(IMAGES_DIR),
            "textbook_images_directory": str(TEXTBOOK_IMAGES_DIR)
        }
        
        return JSONResponse(content=status)
    except Exception as e:
        return JSONResponse(
            content={"status": "unhealthy", "error": str(e)}, 
            status_code=500
        )

# Initialize service on import
initialize_image_service()
