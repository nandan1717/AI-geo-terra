-- Add followed_topics array to app_profiles_v2
alter table public.app_profiles_v2 
add column if not exists followed_topics text[] default array[]::text[];

-- Update RLS (Policies already exist for 'update own profile', so this just works)
-- But ensuring we have an index for faster aggregating later might be good, 
-- though Postgres arrays are tricky to index for aggregation without unnest.
-- For now, a GIN index on the array could help with searching profiles BY topic, 
-- but our use case is "Get ALL topics from ALL profiles". 
-- A simple index won't help much with "Select distinct unnest(followed_topics)".
-- We'll just stick to the column addition.
