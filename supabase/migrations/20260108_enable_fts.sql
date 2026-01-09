-- Migration: Enable Full Text Search and Personalized Feeds

-- 1. Ensure followed_topics exists on app_profiles_v2
alter table public.app_profiles_v2 
add column if not exists followed_topics text[] default '{}';

-- 2. Add FTS column to gdelt_events
alter table public.gdelt_events 
add column if not exists fts tsvector 
generated always as (
  to_tsvector('english', 
    coalesce(title, '') || ' ' || 
    coalesce(description, '') || ' ' || 
    coalesce(vibe, '') || ' ' ||
    coalesce(country, '')
  )
) stored;

-- 3. Create GIN index for fast search
create index if not exists gdelt_events_fts_idx on public.gdelt_events using gin (fts);

-- 4. Create index on published_at for sorting
create index if not exists gdelt_events_published_at_idx on public.gdelt_events (published_at desc);

-- 5. RLS Policy for gdelt_events (Ensure it's readable)
alter table public.gdelt_events enable row level security;

create policy "Enable read access for all users"
on public.gdelt_events for select
using (true);
