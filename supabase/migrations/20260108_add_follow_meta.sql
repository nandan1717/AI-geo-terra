-- Add metadata column for followed topics (e.g. expiration)
alter table public.app_profiles_v2 
add column if not exists followed_topics_meta jsonb default '{}'::jsonb;
