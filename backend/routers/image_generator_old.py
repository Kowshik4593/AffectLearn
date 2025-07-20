# routers/image_generator.py

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
import os
import json
import uuid
import random
from pathlib import Path
import re
import svgwrite
import logging
from auth import get_current_user

# Try to import ChromaDB and SentenceTransformer with fallback
try:
    import chromadb
    from sentence_transformers import SentenceTransformer
    from fuzzywuzzy import fuzz
    CHROMA_AVAILABLE = True
    logger = logging.getLogger(__name__)
    logger.info("ChromaDB and SentenceTransformer imported successfully")
except ImportError as e:
    CHROMA_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning(f"ChromaDB or SentenceTransformer not available: {e}")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/image", tags=["image_generation"])

# Define paths
BASE_DIR = Path(__file__).parent.parent  # chat-backend directory
IMG_RAG_DIR = BASE_DIR / "img_generator_rag"
IMAGES_DIR = BASE_DIR / "static" / "generated_images"
METADATA_DIR = IMG_RAG_DIR / "metadata"
CHROMA_DIR = IMG_RAG_DIR / "chroma_db"

# Create directories if they don't exist
os.makedirs(IMAGES_DIR, exist_ok=True)

# Global variables for lazy loading
image_metadata = []
model = None
collection = None

# Initialize on module import
def init_on_startup():
    """Initialize the service on startup"""
    try:
        initialize_image_service()
        logger.info("Image service initialized on startup")
    except Exception as e:
        logger.error(f"Failed to initialize image service on startup: {e}")

# Call init on module load
init_on_startup()

def initialize_image_service():
    """Initialize the image generation service components"""
    global image_metadata, model, collection
    
    try:
        # Load image metadata from textbooks directory
        textbooks_metadata_path = IMG_RAG_DIR / "textbooks" / "metadata" / "image_metadata.json"
        if textbooks_metadata_path.exists():
            with open(textbooks_metadata_path, "r", encoding="utf-8") as f:
                image_metadata = json.load(f)
            for meta in image_metadata:
                if "image_path" in meta:
                    meta["image_path"] = Path(meta["image_path"]).name
            logger.info(f"Loaded {len(image_metadata)} image metadata entries from {textbooks_metadata_path}")
        else:
            # Try alternative path
            alt_metadata_path = METADATA_DIR / "image_metadata.json"
            if alt_metadata_path.exists():
                with open(alt_metadata_path, "r", encoding="utf-8") as f:
                    image_metadata = json.load(f)
                logger.info(f"Loaded {len(image_metadata)} image metadata entries from {alt_metadata_path}")
            else:
                image_metadata = []
                logger.warning(f"image_metadata.json not found at {textbooks_metadata_path} or {alt_metadata_path}")

        # Initialize ChromaDB client
        if CHROMA_DIR.exists():
            try:
                client = chromadb.PersistentClient(path=str(CHROMA_DIR))
                collection = client.get_collection(name="textbook_chunks")
                logger.info(f"ChromaDB collection loaded successfully from {CHROMA_DIR}")
                logger.info(f"Collection count: {collection.count()}")
            except Exception as e:
                logger.warning(f"Could not load ChromaDB collection: {str(e)}")
                collection = None
        else:
            logger.warning(f"ChromaDB directory not found at {CHROMA_DIR}")
            collection = None

        # Load sentence transformer
        model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("SentenceTransformer model loaded successfully")
        
    except Exception as e:
        logger.error(f"Error initializing image service: {str(e)}")

def generate_svg(query: str) -> str:
    """Generate SVG for specific STEM topics based on query."""
    dwg = svgwrite.Drawing(size=("200px", "200px"))
    query_lower = query.lower()
    
    # Math: Quadratic Equation (more flexible matching)
    if "quadratic" in query_lower and ("equation" in query_lower or "parabola" in query_lower):
        # Generate a sample quadratic: y = x^2 - 2x - 3
        dwg.add(dwg.line((0, 100), (200, 100), stroke="black"))  # x-axis
        dwg.add(dwg.line((100, 0), (100, 200), stroke="black"))  # y-axis
        
        # Generate parabola points
        path_data = "M"
        for x in range(0, 201, 5):
            scaled_x = (x - 100) / 20  # Scale to -5 to 5
            y = scaled_x**2 - 2*scaled_x - 3  # Sample quadratic
            scaled_y = 100 - (y * 10)  # Scale and flip y
            if scaled_y < 0: scaled_y = 0
            if scaled_y > 200: scaled_y = 200
            
            if x == 0:
                path_data += f"{x},{scaled_y}"
            else:
                path_data += f" L{x},{scaled_y}"
        
        dwg.add(dwg.path(d=path_data, stroke="blue", fill="none", stroke_width=2))
        
        # Add labels
        dwg.add(dwg.text("y = x² - 2x - 3", insert=(10, 20), font_size="12", fill="blue"))
        dwg.add(dwg.text("x", insert=(190, 115), font_size="10"))
        dwg.add(dwg.text("y", insert=(105, 15), font_size="10"))
        
        return dwg.tostring()
    
    # Math: Matrix Multiplication
    if "matrix multiplication" in query.lower():
        dwg.add(dwg.rect((50, 50), (50, 50), fill="none", stroke="black"))  # Matrix 1 (2x2)
        dwg.add(dwg.text("1 2", insert=(60, 65), font_size="10"))
        dwg.add(dwg.text("3 4", insert=(60, 85), font_size="10"))
        dwg.add(dwg.rect((110, 50), (50, 50), fill="none", stroke="black"))  # Matrix 2 (2x2)
        dwg.add(dwg.text("5 6", insert=(120, 65), font_size="10"))
        dwg.add(dwg.text("7 8", insert=(120, 85), font_size="10"))
        dwg.add(dwg.text("x", insert=(105, 100), font_size="20"))
        dwg.add(dwg.line((100, 75), (100, 125), stroke="black", stroke_width=2))  # Multiplication arrow
        return dwg.tostring()
    
    # Math/Stats: Probability Distributions
    if "probability distributions" in query.lower():
        dwg.add(dwg.path("M20,180 C40,120 60,80 80,100 C100,80 120,120 140,100 C160,80 180,120 180,180", stroke="green", fill="none"))  # Smoother bell curve
        dwg.add(dwg.line((0, 100), (200, 100), stroke="black"))  # x-axis
        dwg.add(dwg.line((100, 0), (100, 200), stroke="black"))  # y-axis
        dwg.add(dwg.text("μ", insert=(95, 90), font_size="12"))  # Mean
        dwg.add(dwg.text("σ", insert=(150, 90), font_size="12"))  # Standard deviation
        return dwg.tostring()
    
    # Physics: Newton's Laws of Motion
    if "newton's laws of motion" in query.lower():
        dwg.add(dwg.rect((80, 80), (40, 40), fill="gray"))  # Object
        dwg.add(dwg.line((60, 100), (120, 100), stroke="red", stroke_width=2, marker_end="url(#arrow)"))  # Force vector
        dwg.add(dwg.polyline([(60, 100), (65, 95), (65, 105), (60, 100)], fill="red", stroke="none"))  # Arrowhead
        dwg.add(dwg.text("F", insert=(70, 90), font_size="12"))
        dwg.add(dwg.text("m", insert=(90, 70), font_size="12"))
        dwg.add(dwg.text("a", insert=(110, 90), font_size="12"))
        dwg.defs.add(dwg.marker(id="arrow", markerWidth="5", markerHeight="5", refX="0", refY="2.5", orient="auto"))
        dwg.add(dwg.use("#arrow", href="#arrow"))
        return dwg.tostring()
    
    # Engineering: Stress-Strain Curve
    if "stress-strain curve" in query.lower():
        dwg.add(dwg.path("M20,180 L60,120 L100,100 L140,130 L180,150", stroke="purple", fill="none"))  # Detailed curve
        dwg.add(dwg.line((0, 100), (200, 100), stroke="black"))  # x-axis (Strain)
        dwg.add(dwg.line((100, 0), (100, 200), stroke="black"))  # y-axis (Stress)
        dwg.add(dwg.text("Elastic", insert=(30, 110), font_size="10", rotate=90))
        dwg.add(dwg.text("Plastic", insert=(130, 110), font_size="10", rotate=90))
        return dwg.tostring()
    
    # Physics: Light and Optics
    if "light and optics" in query.lower():
        dwg.add(dwg.ellipse((100, 100), (30, 20), fill="none", stroke="black"))  # Lens
        dwg.add(dwg.line((50, 100), (70, 100), stroke="orange"))  # Incident ray
        dwg.add(dwg.line((130, 100), (150, 100), stroke="orange"))  # Refracted ray
        dwg.add(dwg.line((70, 90), (130, 110), stroke="orange", stroke_dasharray="2"))  # Refraction path
        dwg.add(dwg.text("Lens", insert=(90, 90), font_size="12"))
        return dwg.tostring()
    
    # CS: Deep Learning
    if "deep learning" in query_lower or ("deep" in query_lower and "learning" in query_lower):
        # Neural network visualization
        dwg.add(dwg.circle((50, 50), 8, fill="lightblue", stroke="blue"))   # Input layer
        dwg.add(dwg.circle((50, 100), 8, fill="lightblue", stroke="blue"))
        dwg.add(dwg.circle((50, 150), 8, fill="lightblue", stroke="blue"))
        
        dwg.add(dwg.circle((100, 40), 8, fill="lightgreen", stroke="green"))  # Hidden layer 1
        dwg.add(dwg.circle((100, 80), 8, fill="lightgreen", stroke="green"))
        dwg.add(dwg.circle((100, 120), 8, fill="lightgreen", stroke="green"))
        dwg.add(dwg.circle((100, 160), 8, fill="lightgreen", stroke="green"))
        
        dwg.add(dwg.circle((150, 60), 8, fill="lightgreen", stroke="green"))  # Hidden layer 2
        dwg.add(dwg.circle((150, 100), 8, fill="lightgreen", stroke="green"))
        dwg.add(dwg.circle((150, 140), 8, fill="lightgreen", stroke="green"))
        
        dwg.add(dwg.circle((190, 100), 8, fill="orange", stroke="red"))      # Output layer
        
        # Connections (simplified)
        connections = [
            ((50, 50), (100, 40)), ((50, 50), (100, 80)), ((50, 100), (100, 120)),
            ((100, 40), (150, 60)), ((100, 80), (150, 100)), ((150, 100), (190, 100))
        ]
        for (x1, y1), (x2, y2) in connections:
            dwg.add(dwg.line((x1, y1), (x2, y2), stroke="gray", stroke_width=1))
        
        dwg.add(dwg.text("Deep Learning", insert=(60, 20), font_size="12", fill="blue"))
        dwg.add(dwg.text("Neural Network", insert=(60, 190), font_size="10", fill="gray"))
        return dwg.tostring()
    
    # CS: Artificial Intelligence
    if "artificial intelligence" in query_lower:
        dwg.add(dwg.circle((100, 100), 70, fill="none", stroke="blue"))  # Large AI circle
        dwg.add(dwg.text("AI", insert=(90, 100), font_size="20"))
        return dwg.tostring()
    
    # CS: LLM
    if "llm" in query.lower():
        dwg.add(dwg.circle((100, 100), 70, fill="none", stroke="blue"))  # Large AI circle
        dwg.add(dwg.circle((100, 100), 40, fill="none", stroke="green"))  # DL circle
        dwg.add(dwg.circle((110, 90), 15, fill="none", stroke="purple"))  # LLM circle
        dwg.add(dwg.text("AI", insert=(90, 100), font_size="12"))
        dwg.add(dwg.text("DL", insert=(90, 90), font_size="12"))
        dwg.add(dwg.text("LLM", insert=(105, 85), font_size="10"))
        dwg.add(dwg.text("(Subtopic)", insert=(95, 115), font_size="8"))
        return dwg.tostring()
    
    # Chemistry: Water molecule
    if "water molecule" in query.lower():
        dwg.add(dwg.circle((100, 100), 20, fill="red"))  # Oxygen
        dwg.add(dwg.circle((60, 60), 10, fill="lightblue"))  # H1
        dwg.add(dwg.circle((140, 60), 10, fill="lightblue"))  # H2
        dwg.add(dwg.line((80, 80), (70, 70), stroke="black"))  # Bond O-H1
        dwg.add(dwg.line((120, 80), (130, 70), stroke="black"))  # Bond O-H2
        dwg.add(dwg.text("O", insert=(95, 105), font_size="12"))
        dwg.add(dwg.text("H", insert=(55, 65), font_size="10"))
        dwg.add(dwg.text("H", insert=(135, 65), font_size="10"))
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
    # Define textbook images directory - check both locations
    textbook_images_dir = IMG_RAG_DIR / "images"
    source_path = textbook_images_dir / image_path
    
    # If not found in img_generator_rag/images, try the main images directory
    if not source_path.exists():
        alt_images_dir = BASE_DIR / "images"
        source_path = alt_images_dir / image_path
    
    if not source_path.exists():
        logger.error(f"Textbook image not found in either {textbook_images_dir / image_path} or {alt_images_dir / image_path}")
        return ""
    
    # Generate filename with proper extension
    original_extension = Path(image_path).suffix
    if not original_extension:
        original_extension = ".jpg"  # Default extension
    
    file_name = f"{query_id}_{Path(image_path).stem}{original_extension}"
    dest_path = IMAGES_DIR / file_name
    
    try:
        # Copy the file
        with open(source_path, "rb") as source_file, open(dest_path, "wb") as dest_file:
            dest_file.write(source_file.read())
        logger.info(f"Copied textbook image from {source_path} to {dest_path}")
        return f"/api/static/generated_images/{file_name}"
    except Exception as e:
        logger.error(f"Exception copying textbook image from {source_path} to {dest_path}: {str(e)}")
        return ""

def get_image_for_query(query: str, query_id: str = None) -> dict:
    """Get an image (SVG or textbook) for a given query"""
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
        # First try to generate SVG
        svg_code = generate_svg(query)
        if svg_code:
            image_url = save_svg_locally(svg_code, query, query_id)
            result["image_url"] = image_url
            result["image_type"] = "svg"
            result["svg_code"] = svg_code
            logger.info(f"Generated SVG for query: {query}")
            return result
        
        # If no SVG generated and ChromaDB is available, search for textbook images
        if collection and model:
            try:
                query_embedding = model.encode([query])[0]
                search_results = collection.query(query_embeddings=[query_embedding], n_results=5)
                
                logger.info(f"ChromaDB search for '{query}' returned {len(search_results['documents'][0])} results")
                
                for doc, meta, id_ in zip(search_results["documents"][0], search_results["metadatas"][0], search_results["ids"][0]):
                    if meta.get("type") == "text":
                        result["explanations"].append({
                            "text": doc[:300], 
                            "pdf_name": meta.get("pdf_name", ""), 
                            "page_num": meta.get("page_num", 0)
                        })
                    elif meta.get("type") == "image" and "image_path" in meta and not result["image_url"]:
                        # Copy the actual textbook image to static directory
                        image_path = meta["image_path"]
                        logger.info(f"Found textbook image: {image_path}")
                        copied_url = save_textbook_image_locally(image_path, query, query_id)
                        if copied_url:
                            result["image_url"] = copied_url
                            result["image_type"] = "textbook"
                            logger.info(f"Successfully copied textbook image for query: {query}")
                            break
                
                result["explanations"] = result["explanations"][:2]  # Limit to 2 explanations
            except Exception as e:
                logger.error(f"Error during ChromaDB search: {str(e)}")
        else:
            logger.warning("ChromaDB collection or model not available for textbook image search")
        
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

@router.get("/health")
async def image_service_health():
    """Health check for image generation service"""
    try:
        # Initialize if needed
        if model is None:
            initialize_image_service()
        
        status = {
            "status": "healthy",
            "model_loaded": model is not None,
            "chromadb_available": collection is not None,
            "image_metadata_count": len(image_metadata),
            "images_directory": str(IMAGES_DIR),
            "chroma_directory": str(CHROMA_DIR)
        }
        
        if collection:
            try:
                status["chroma_chunks"] = collection.count()
            except:
                status["chroma_chunks"] = "unavailable"
        
        return JSONResponse(content=status)
    except Exception as e:
        return JSONResponse(
            content={"status": "unhealthy", "error": str(e)}, 
            status_code=500
        )

@router.get("/serve-generated-image/{image_name}")
async def serve_generated_image(image_name: str):
    """Serve a generated image file"""
    try:
        image_path = IMAGES_DIR / image_name
        if image_path.exists():
            return FileResponse(image_path)
        else:
            raise HTTPException(status_code=404, detail="Image not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/explain-topic")
async def explain_topic(query: str, query_id: str = None, format: str = "json"):
    """Generate image explanation for a given query"""
    try:
        # Initialize if needed
        if model is None:
            initialize_image_service()
            
        if not query_id:
            query_id = str(uuid.uuid4())
            
        # Generate SVG if possible
        svg_code = generate_svg(query)
        image_url = None
        explanations = []
        
        # Get explanations from ChromaDB (using mock data for now)
        if collection and model:
            try:
                query_embedding = model.encode([query])[0]
                results = collection.query(query_embeddings=[query_embedding], n_results=3)
                
                for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
                    if meta.get("type") == "text":
                        explanations.append({
                            "text": doc[:500],
                            "pdf_name": meta.get("pdf_name", "Unknown"),
                            "page_num": meta.get("page_num", 0)
                        })
            except Exception as e:
                logger.warning(f"Error querying ChromaDB: {e}")
                # Fallback to sample explanation
                explanations = [{
                    "text": f"This is an explanation about {query}. The system provides detailed information about this topic.",
                    "pdf_name": "Sample Textbook",
                    "page_num": 1
                }]
        
        # Save SVG if generated
        if svg_code:
            file_name = f"{query_id}_{query.replace(' ', '_')}.svg"
            file_path = IMAGES_DIR / file_name
            try:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(svg_code)
                image_url = f"/api/static/generated_images/{file_name}"
                logger.info(f"Saved SVG to {file_path}")
            except Exception as e:
                logger.error(f"Error saving SVG: {e}")
        
        response_data = {
            "query": query,
            "query_id": query_id,
            "explanations": explanations,
            "image_url": image_url,
            "svg_code": svg_code,
            "debug": {
                "svg_generated": bool(svg_code),
                "explanations_count": len(explanations)
            }
        }
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"Error in explain_topic: {e}")
        return JSONResponse(
            content={"error": f"Server error: {str(e)}"}, 
            status_code=500
        )
