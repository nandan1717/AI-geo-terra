-- FIX: Restore missing 'user_stats' table (Version 2)
-- Reason: Legacy trigger does "ON CONFLICT (user_id)", so user_id MUST be unique.

-- 1. Drop the incomplete table if it exists (so we can recreate it correctly)
DROP TABLE IF EXISTS public.user_stats CASCADE;

-- 2. Create table with UNIQUE constraint on user_id
CREATE TABLE public.user_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  xp integer DEFAULT 0,
  level integer DEFAULT 1,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- CRITICAL: This is what the legacy trigger requires for "ON CONFLICT (user_id)"
  CONSTRAINT user_stats_user_id_key UNIQUE (user_id)
);

-- 3. Enable RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.user_stats FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert" ON public.user_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow user update" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);
