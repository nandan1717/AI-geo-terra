-- Reset Gamification Stats for ALL users
-- Use this to clear old/inflated XP data

UPDATE public.app_profiles_v2
SET 
  xp = 0,
  level = 1,
  region_stats = '{}'::jsonb,
  visited_countries = '[]'::jsonb,
  visited_continents = '[]'::jsonb,
  visited_regions = '[]'::jsonb;

-- Optional: If you want to delete all posts too, uncomment the following line:
-- DELETE FROM public.app_posts;
