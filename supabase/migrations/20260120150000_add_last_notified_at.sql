-- Add last_notified_at column to app_profiles_v2 for notification cooldown tracking

ALTER TABLE public.app_profiles_v2 
ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP WITH TIME ZONE;

-- Create an index to optimize queries filtering by this column
CREATE INDEX IF NOT EXISTS idx_profiles_last_notified_at 
ON public.app_profiles_v2(last_notified_at);
