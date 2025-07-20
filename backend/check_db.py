import os
from dotenv import load_dotenv
import psycopg2
load_dotenv()

try:
    conn = psycopg2.connect(dsn=os.getenv('DATABASE_URL'))
    with conn.cursor() as cur:
        cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('chats', 'sessions', 'queries', 'users')
        ORDER BY table_name;
        """)
        tables = [row[0] for row in cur.fetchall()]
        print('Available tables:', tables)
        
        # Check chats table structure
        if 'chats' in tables:
            cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'chats' 
            ORDER BY ordinal_position;
            """)
            print('\nChats table columns:')
            for col in cur.fetchall():
                print(f'  {col[0]}: {col[1]} (nullable: {col[2]})')
        else:
            print('\nChats table does not exist!')
            
        # Check sessions table
        if 'sessions' in tables:
            cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'sessions' 
            ORDER BY ordinal_position;
            """)
            print('\nSessions table columns:')
            for col in cur.fetchall():
                print(f'  {col[0]}: {col[1]} (nullable: {col[2]})')
        else:
            print('\nSessions table does not exist!')
            
except Exception as e:
    print(f'Database error: {e}')
