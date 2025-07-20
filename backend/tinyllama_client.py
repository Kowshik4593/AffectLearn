# tinyllama_client.py

import requests
import json
from typing import Optional

# Assuming the TinyLlama model is running on a separate port
TINYLLAMA_BASE_URL = "http://localhost:8001"  # Adjust port as needed

def get_sentiment_adaptive_prompt(query: str, sentiment: str, level: str = "college", affiliation: str = "student") -> str:
    """
    Create a sentiment-adaptive prompt for TinyLlama based on the user's emotional state
    """
    base_intro = f"You are a compassionate and emotionally intelligent STEM tutor for a {level} {affiliation}."
    
    if sentiment.upper() == "NEGATIVE":
        sentiment_guidance = """
        The student is feeling negative or frustrated. Your response should:
        - Be encouraging and supportive
        - Break down complex concepts into simpler steps
        - Use positive, reassuring language
        - Acknowledge that learning can be challenging
        - Provide confidence-building explanations
        - Include phrases like "Don't worry, this is common" or "Let's break this down together"
        """
    elif sentiment.upper() == "POSITIVE":
        sentiment_guidance = """
        The student is feeling positive and engaged. Your response should:
        - Match their enthusiasm and energy
        - Provide comprehensive explanations
        - Include interesting additional insights
        - Encourage further exploration
        - Use energetic, motivating language
        - Build on their positive momentum
        """
    else:  # NEUTRAL
        sentiment_guidance = """
        The student has a neutral emotional state. Your response should:
        - Be clear and straightforward
        - Provide balanced, informative explanations
        - Use professional but friendly tone
        - Focus on accuracy and completeness
        - Maintain engagement without being overly enthusiastic
        """
    
    return f"{base_intro}\n\n{sentiment_guidance}\n\nNow answer this question: {query}"

def get_tinyllama_response(query: str, sentiment: str, level: str = "college", affiliation: str = "student", mode: str = "default") -> Optional[str]:
    """
    Get response from TinyLlama model with sentiment-adaptive prompting
    """
    try:
        # Create sentiment-adaptive prompt
        adaptive_prompt = get_sentiment_adaptive_prompt(query, sentiment, level, affiliation)
        
        # Prepare request data
        request_data = {
            "query": adaptive_prompt,
            "level": level,
            "affiliation": affiliation,
            "mode": mode
        }
        
        # Call TinyLlama API
        response = requests.post(
            f"{TINYLLAMA_BASE_URL}/explain",
            json=request_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            return result.get("answer", "")
        else:
            print(f"TinyLlama API error: {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"Error calling TinyLlama API: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error in TinyLlama client: {e}")
        return None

def get_tinyllama_sentiment_adaptive_response(query: str, sentiment: str, sentiment_score: float, context: str = "") -> Optional[str]:
    """
    Get a sentiment-adaptive response from TinyLlama with additional context
    """
    try:
        # Enhanced prompt with sentiment score consideration
        intensity = "strongly" if sentiment_score > 0.8 else "moderately" if sentiment_score > 0.6 else "slightly"
        
        enhanced_prompt = f"""
        Context from previous conversation:
        {context}
        
        Current student state: {intensity} {sentiment.lower()}
        
        Question: {query}
        
        Provide a response that is specifically adapted to help a student who is feeling {intensity} {sentiment.lower()}.
        """
        
        request_data = {
            "query": enhanced_prompt,
            "level": "college",
            "affiliation": "student", 
            "mode": "default"
        }
        
        response = requests.post(
            f"{TINYLLAMA_BASE_URL}/explain",
            json=request_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            return result.get("answer", "")
        else:
            print(f"TinyLlama API error: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Error in sentiment-adaptive TinyLlama call: {e}")
        return None

def check_tinyllama_health() -> bool:
    """
    Check if TinyLlama service is running and healthy
    """
    try:
        response = requests.get(f"{TINYLLAMA_BASE_URL}/", timeout=5)
        return response.status_code == 200
    except:
        return False
