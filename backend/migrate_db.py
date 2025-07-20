# Database Schema Migration Script
# Creates tables for the chat system if they don't exist

import os
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

load_dotenv()

def create_tables():
    try:
        # Connect to database
        conn = psycopg2.connect(
            dsn=os.getenv("DATABASE_URL"),
            cursor_factory=psycopg2.extras.DictCursor
        )
        
        with conn.cursor() as cur:
            print("Creating database tables...")
            
            # 1. Create users table if not exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    supabase_user_id UUID UNIQUE NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    full_name VARCHAR(255),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            """)
            print("✓ Users table created/verified")
            
            # 2. Create chats table if not exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS chats (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL,
                    title VARCHAR(500) DEFAULT 'New Chat',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
                );
            """)
            print("✓ Chats table created/verified")
            
            # 3. Create sessions table if not exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    chat_id UUID NOT NULL,
                    user_id UUID NOT NULL,
                    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    ended_at TIMESTAMP WITH TIME ZONE,
                    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
                );
            """)
            print("✓ Sessions table created/verified")
            
            # 4. Update queries table to include tinyllama_response if not exists
            cur.execute("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                                  WHERE table_name = 'queries' AND column_name = 'tinyllama_response') THEN
                        ALTER TABLE queries ADD COLUMN tinyllama_response TEXT;
                    END IF;
                END $$;
            """)
            print("✓ Queries table tinyllama_response column added/verified")
            
            # 5. Ensure queries table exists with all necessary columns
            cur.execute("""
                CREATE TABLE IF NOT EXISTS queries (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    session_id UUID NOT NULL,
                    query_index INTEGER DEFAULT 0,
                    query_text TEXT NOT NULL,
                    input_type VARCHAR(50) DEFAULT 'text',
                    transcript TEXT,
                    sentiment_label VARCHAR(20),
                    sentiment_score FLOAT,
                    tinyllama_response TEXT,
                    groq_response_main TEXT,
                    groq_response_simplified TEXT,
                    response_language VARCHAR(10) DEFAULT 'en',
                    input_audio_url TEXT,
                    explanation_audio_url TEXT,
                    user_id UUID NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
                );
            """)
            print("✓ Queries table created/verified")
            
            # 6. Create indexes for better performance
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
                CREATE INDEX IF NOT EXISTS idx_chats_last_active ON chats(last_active DESC);
                CREATE INDEX IF NOT EXISTS idx_sessions_chat_id ON sessions(chat_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
                CREATE INDEX IF NOT EXISTS idx_queries_session_id ON queries(session_id);
                CREATE INDEX IF NOT EXISTS idx_queries_user_id ON queries(user_id);
                CREATE INDEX IF NOT EXISTS idx_queries_created_at ON queries(created_at DESC);
            """)
            print("✓ Database indexes created/verified")
            
            # Commit all changes
            conn.commit()
            print("\n🎉 Database migration completed successfully!")
            
            # Test the tables
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
            tables = [row[0] for row in cur.fetchall()]
            print(f"\nAvailable tables: {tables}")
            
    except Exception as e:
        print(f"❌ Database migration failed: {e}")
        if 'conn' in locals():
            conn.rollback()
        raise
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    create_tables()
