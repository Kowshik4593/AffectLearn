-- Quiz and Analytics Database Schema for LLM Integration
-- Run this script in your Supabase SQL editor to add quiz and analytics functionality

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sessions table for quiz/learning sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  user_selected_difficulty text,
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  quiz_index integer NOT NULL DEFAULT 0,
  questions jsonb NOT NULL,
  options jsonb NOT NULL,
  correct_answers jsonb NOT NULL,
  explanations jsonb,
  user_answers jsonb NOT NULL,
  quiz_score double precision NOT NULL,
  difficulty text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT quizzes_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE
);

-- Update existing queries table to include sentiment data (if it doesn't exist)
-- First check if the table exists and add columns if needed
DO $$ 
BEGIN
  -- Add sentiment_score column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'queries' AND column_name = 'sentiment_score') THEN
    ALTER TABLE public.queries ADD COLUMN sentiment_score double precision;
  END IF;
  
  -- Add sentiment_label column if it doesn't exist  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'queries' AND column_name = 'sentiment_label') THEN
    ALTER TABLE public.queries ADD COLUMN sentiment_label text CHECK (sentiment_label = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text]));
  END IF;
END $$;

-- Enable Row Level Security (RLS)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.sessions;

CREATE POLICY "Users can view own sessions" ON public.sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.sessions FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for quizzes (accessed via session user_id)
DROP POLICY IF EXISTS "Users can view own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Users can insert own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Users can update own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Users can delete own quizzes" ON public.quizzes;

CREATE POLICY "Users can view own quizzes" ON public.quizzes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE sessions.id = quizzes.session_id 
    AND sessions.user_id = auth.uid()
  )
);
CREATE POLICY "Users can insert own quizzes" ON public.quizzes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE sessions.id = quizzes.session_id 
    AND sessions.user_id = auth.uid()
  )
);
CREATE POLICY "Users can update own quizzes" ON public.quizzes FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE sessions.id = quizzes.session_id 
    AND sessions.user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete own quizzes" ON public.quizzes FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE sessions.id = quizzes.session_id 
    AND sessions.user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON public.sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_quizzes_session_id ON public.quizzes(session_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON public.quizzes(created_at);

-- Add comment for documentation
COMMENT ON TABLE public.sessions IS 'Learning sessions for quiz tracking and analytics';
COMMENT ON TABLE public.quizzes IS 'Quiz data including questions, answers, and scores';

-- Verify the tables were created successfully
SELECT 
  'sessions' as table_name,
  COUNT(*) as row_count
FROM public.sessions
UNION ALL
SELECT 
  'quizzes' as table_name,
  COUNT(*) as row_count  
FROM public.quizzes;
