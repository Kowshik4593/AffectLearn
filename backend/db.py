# db.py

import psycopg2
import psycopg2.extras
import psycopg2.errors
import os
from dotenv import load_dotenv
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
load_dotenv()

# Database connection
_connection = None

def get_db_connection():
    global _connection
    
    # Always try to get a fresh connection to avoid transaction issues
    try:
        # Close any existing connection that might be in a bad state
        if _connection:
            try:
                if not _connection.closed:
                    _connection.close()
            except:
                pass
            _connection = None
        
        # Create a completely fresh connection
        db_url = os.getenv("DATABASE_URL")
        print(f"Creating fresh database connection...")
        
        _connection = psycopg2.connect(
            dsn=db_url,
            cursor_factory=psycopg2.extras.DictCursor,
            connect_timeout=10,
            options='-c statement_timeout=30000'
        )
        
        # Set autocommit to True to avoid transaction state issues
        _connection.set_session(autocommit=True)
        print("Fresh database connection established successfully")
        
        # Test the connection
        with _connection.cursor() as test_cur:
            test_cur.execute("SELECT 1")
            print("Database connection test passed")
        
        return _connection
        
    except Exception as e:
        print(f"Database connection error: {e}")
        print(f"Full error type: {type(e).__name__}")
        _connection = None
        raise

def return_db_connection(conn):
    """Legacy function for compatibility - not needed with single connection approach"""
    pass

def reset_db_connection():
    """Force reset the database connection"""
    global _connection
    print("Forcing database connection reset...")
    if _connection:
        try:
            _connection.close()
        except:
            pass
    _connection = None
    # Get a fresh connection
    return get_db_connection()

# Sentiment model (CardiffNLP)
model_dir = "cardiff-sentiment-local"
tokenizer = AutoTokenizer.from_pretrained(model_dir)
model = AutoModelForSequenceClassification.from_pretrained(model_dir)
classifier = pipeline("sentiment-analysis", model=model, tokenizer=tokenizer)

def save_query_to_db(query_data):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Try to add tinyllama_response column if it doesn't exist
            try:
                cur.execute("ALTER TABLE queries ADD COLUMN IF NOT EXISTS tinyllama_response TEXT;")
            except Exception as col_error:
                print(f"Column addition error (likely already exists): {col_error}")
            
            cur.execute("""
                INSERT INTO queries (
                    id, session_id, query_index, query_text, input_type, transcript,
                    sentiment_label, sentiment_score,
                    tinyllama_response, groq_response_main, groq_response_simplified, response_language,
                    input_audio_url, explanation_audio_url, user_id, created_at
                ) VALUES (
                    %(id)s, %(session_id)s, %(query_index)s, %(query_text)s, %(input_type)s, %(transcript)s,
                    %(sentiment_label)s, %(sentiment_score)s,
                    %(tinyllama_response)s, %(groq_response_main)s, %(groq_response_simplified)s, %(response_language)s,
                    %(input_audio_url)s, %(explanation_audio_url)s, %(user_id)s, %(created_at)s
                );
            """, {
                'id': query_data.get('id', None),
                'session_id': query_data.get('session_id', None),
                'query_index': query_data.get('query_index', None),
                'query_text': query_data.get('query_text', None),
                'input_type': query_data.get('input_type', None),
                'transcript': query_data.get('transcript', None),
                'sentiment_label': query_data.get('sentiment_label', None),
                'sentiment_score': query_data.get('sentiment_score', None),
                'tinyllama_response': query_data.get('tinyllama_response', None),
                'groq_response_main': query_data.get('groq_response_main', None),
                'groq_response_simplified': query_data.get('groq_response_simplified', None),
                'response_language': query_data.get('response_language', None),
                'input_audio_url': query_data.get('input_audio_url', None),
                'explanation_audio_url': query_data.get('explanation_audio_url', None),
                'user_id': query_data.get('user_id', None),
                'created_at': query_data.get('created_at', None)
            })
            print("Query saved to database successfully")
    except Exception as e:
        print(f"Database error in save_query_to_db: {e}")
        if conn:
            try:
                conn.rollback()
                print("Transaction rolled back")
            except Exception as rollback_error:
                print(f"Rollback error: {rollback_error}")
        raise

def save_standalone_query_to_db(query_data):
    """
    Save a standalone query to the database without requiring a session_id.
    This is useful for audio transcription queries that don't belong to a chat session.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO queries (
                    id, session_id, query_index, query_text, input_type, transcript,
                    sentiment_label, sentiment_score,
                    groq_response_main, groq_response_simplified, response_language,
                    input_audio_url, explanation_audio_url, user_id, created_at
                ) VALUES (
                    %(id)s, %(session_id)s, %(query_index)s, %(query_text)s, %(input_type)s, %(transcript)s,
                    %(sentiment_label)s, %(sentiment_score)s,
                    %(groq_response_main)s, %(groq_response_simplified)s, %(response_language)s,
                    %(input_audio_url)s, %(explanation_audio_url)s, %(user_id)s, %(created_at)s
                );
            """, {
                'id': query_data.get('id', None),
                'session_id': query_data.get('session_id', None),  # Allow null
                'query_index': query_data.get('query_index', 0),
                'query_text': query_data.get('query_text', None),
                'input_type': query_data.get('input_type', None),
                'transcript': query_data.get('transcript', None),
                'sentiment_label': query_data.get('sentiment_label', None),
                'sentiment_score': query_data.get('sentiment_score', None),
                'groq_response_main': query_data.get('groq_response_main', None),
                'groq_response_simplified': query_data.get('groq_response_simplified', None),
                'response_language': query_data.get('response_language', None),
                'input_audio_url': query_data.get('input_audio_url', None),
                'explanation_audio_url': query_data.get('explanation_audio_url', None),
                'user_id': query_data.get('user_id', None),
                'created_at': query_data.get('created_at', None)
            })
    except Exception as e:
        print(f"Database error in save_standalone_query_to_db: {e}")
        raise

def get_session_context(session_id):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT query_text, COALESCE(tinyllama_response, groq_response_main) as response FROM queries
                WHERE session_id = %s ORDER BY query_index ASC;
            """, (session_id,))
            rows = cur.fetchall()
            return [f"Q: {row[0]}\nA: {row[1]}" for row in rows if row[1]]  # Only include rows with responses
    except Exception as e:
        print(f"Database error in get_session_context: {e}")
        print("Returning empty context due to database error")
        return []  # Return empty context if database is unavailable

def get_sentiment_from_text(text):
    result = classifier(text)[0]
    label = result["label"].lower()
    confidence = result["score"]

    # Completion override logic
    completion_keywords = ["completed", "finished", "done", "understood", "accomplished"]
    if any(k in text.lower() for k in completion_keywords):
        if label == "positive" and confidence < 0.8:
            return "NEUTRAL", 0

    # Score based on confidence
    if label == "positive":
        if confidence > 0.8: return "POSITIVE", 2
        elif confidence > 0.6: return "POSITIVE", 1
        else: return "POSITIVE", 0.5
    elif label == "negative":
        if confidence > 0.8: return "NEGATIVE", -2
        elif confidence > 0.6: return "NEGATIVE", -1
        else: return "NEGATIVE", -0.5
    return "NEUTRAL", 0

def reset_db_connection():
    """Force reset the database connection - useful when connection is corrupted"""
    global _connection
    try:
        if _connection and not _connection.closed:
            _connection.close()
    except:
        pass
    _connection = None
    print("Database connection reset")

