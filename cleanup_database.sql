-- Cleanup script to remove tables and columns added during development
-- that are not in the production version

-- Remove followers/following columns from user_stats if they exist
ALTER TABLE public.user_stats 
  DROP COLUMN IF EXISTS followers_count,
  DROP COLUMN IF EXISTS following_count;

-- Remove tracking columns from chat_sessions if they exist
ALTER TABLE public.chat_sessions 
  DROP COLUMN IF EXISTS interaction_count,
  DROP COLUMN IF EXISTS is_favorite,
  DROP COLUMN IF EXISTS unlocked_at;

-- Drop profile system tables if they exist
DROP TABLE IF EXISTS public.user_activity CASCADE;
DROP TABLE IF EXISTS public.user_badges CASCADE;
DROP TABLE IF EXISTS public.user_places CASCADE;

-- Drop any indexes that were created for these features
DROP INDEX IF EXISTS public.chat_sessions_user_favorite_idx;

-- Note: This script is safe to run multiple times
-- It will only drop columns/tables that exist
