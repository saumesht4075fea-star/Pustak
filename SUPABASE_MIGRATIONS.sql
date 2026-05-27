-- Supabase Migrations for PUSTAK
-- Run these in your Supabase SQL Editor to fix schema issues

-- 1. Add missing columns to courses table for Intro Videos
ALTER TABLE courses ADD COLUMN IF NOT EXISTS intro_mux_asset_id TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS intro_mux_playback_id TEXT;

-- 2. Create Progress Tracking Table (Harmonized Name)
CREATE TABLE IF NOT EXISTS course_video_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  video_id UUID REFERENCES course_videos(id) ON DELETE CASCADE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- 3. Enable RLS and Add Policies for Progress
ALTER TABLE course_video_progress ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own progress
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own progress' AND tablename = 'course_video_progress') THEN
        CREATE POLICY "Users can view their own progress" ON course_video_progress FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- Allow users to upsert their own progress
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own progress' AND tablename = 'course_video_progress') THEN
        CREATE POLICY "Users can update their own progress" ON course_video_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Ensure Course Videos table has order_index
ALTER TABLE course_videos ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE course_videos ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE course_videos ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT FALSE;
