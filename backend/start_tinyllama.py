#!/usr/bin/env python3
"""
TinyLlama Model Server Startup Script
Run this script to start the TinyLlama model service on port 8001
"""

import subprocess
import sys
import os
import time

def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import uvicorn
        import fastapi
        import transformers
        import peft
        import torch
        print("✓ All dependencies are available")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("Please install required packages:")
        print("pip install uvicorn fastapi transformers peft torch")
        return False

def start_tinyllama_server():
    """Start the TinyLlama model server"""
    model_dir = os.path.join(os.path.dirname(__file__), "model")
    app_file = os.path.join(model_dir, "LLM_app.py")
    
    if not os.path.exists(app_file):
        print(f"✗ TinyLlama app file not found: {app_file}")
        return False
    
    print("🚀 Starting TinyLlama model server...")
    print(f"📁 Model directory: {model_dir}")
    print("🌐 Server will be available at: http://localhost:8001")
    print("📋 API documentation: http://localhost:8001/docs")
    print("\n" + "="*50)
    
    try:
        # Start the server
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "LLM_app:app", 
            "--host", "0.0.0.0", 
            "--port", "8001",
            "--reload"
        ], cwd=model_dir, check=True)
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to start server: {e}")
        return False
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
        return True

def main():
    print("TinyLlama Model Server Startup")
    print("=" * 40)
    
    if not check_dependencies():
        sys.exit(1)
    
    success = start_tinyllama_server()
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
