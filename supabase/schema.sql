-- ExamGrade AI - Full Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- USERS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'premium')),
  papers_used INTEGER NOT NULL DEFAULT 0,
  papers_limit INTEGER NOT NULL DEFAULT 5,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  billing_period_start TIMESTAMPTZ,
  billing_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- UPLOADS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_id UUID,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  upload_type TEXT NOT NULL CHECK (upload_type IN ('question_paper', 'sample_answer', 'student_script')),
  student_name TEXT,
  student_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- GRADING JOBS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.grading_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Grading Job',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  difficulty_mode TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty_mode IN ('easy', 'medium', 'hard')),
  total_papers INTEGER NOT NULL DEFAULT 0,
  processed_papers INTEGER NOT NULL DEFAULT 0,
  failed_papers INTEGER NOT NULL DEFAULT 0,
  question_paper_url TEXT,
  sample_answer_url TEXT,
  csv_report_url TEXT,
  pdf_report_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- =====================
-- GRADING RESULTS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.grading_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.grading_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_id TEXT,
  student_name TEXT NOT NULL,
  total_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2),
  grade TEXT,
  question_breakdown JSONB,
  overall_feedback TEXT,
  raw_ai_response JSONB,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- GRADING SETTINGS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.grading_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  difficulty_mode TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty_mode IN ('easy', 'medium', 'hard')),
  custom_prompt_override TEXT,
  use_custom_prompt BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, difficulty_mode)
);

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grading_settings ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Uploads policies
CREATE POLICY "Users can view own uploads" ON public.uploads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own uploads" ON public.uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own uploads" ON public.uploads
  FOR DELETE USING (auth.uid() = user_id);

-- Grading jobs policies
CREATE POLICY "Users can view own jobs" ON public.grading_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON public.grading_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.grading_jobs
  FOR UPDATE USING (auth.uid() = user_id);

-- Grading results policies
CREATE POLICY "Users can view own results" ON public.grading_results
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own results" ON public.grading_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grading settings policies
CREATE POLICY "Users can manage own settings" ON public.grading_settings
  FOR ALL USING (auth.uid() = user_id);

-- =====================
-- FUNCTIONS & TRIGGERS
-- =====================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();
CREATE TRIGGER update_grading_jobs_updated_at BEFORE UPDATE ON public.grading_jobs
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();
CREATE TRIGGER update_grading_settings_updated_at BEFORE UPDATE ON public.grading_settings
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- =====================
-- STORAGE BUCKETS (run in Supabase dashboard)
-- =====================
-- Create bucket: exam-files (private)
-- Create bucket: reports (private)
