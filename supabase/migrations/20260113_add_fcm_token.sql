-- Add fcm_token column to app_profiles_v2
alter table public.app_profiles_v2
add column if not exists fcm_token text;

-- Add index for faster lookups (optional but good for your batch queries)
create index if not exists app_profiles_v2_fcm_token_idx on public.app_profiles_v2 (fcm_token);
