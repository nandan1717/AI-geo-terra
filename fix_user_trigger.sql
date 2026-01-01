-- FIX: Robust User Creation Trigger for Google Login
-- Reason: Previous trigger likely failed on constraint violations (username format) or null values.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  default_username text;
  fullname text;
  avatar text;
BEGIN
  -- 1. Generate a safe, regex-compliant username
  -- Format: "user*<first-8-chars-of-uuid>"
  -- Regex satisfied: ^[a-z0-9*]+$ (uuids are hex, so 0-9, a-f)
  default_username := 'user*' || SUBSTRING(new.id::text FROM 1 FOR 8);

  -- 2. Extract metadata with safe fallbacks
  -- Google usually provides 'full_name' and 'avatar_url' in raw_user_meta_data
  fullname := COALESCE(new.raw_user_meta_data->>'full_name', 'Mortal User');
  avatar := COALESCE(new.raw_user_meta_data->>'avatar_url', '');

  -- 3. Insert into app_profiles_v2
  -- explicit columns to avoid mismatch
  INSERT INTO public.app_profiles_v2 (
    id, 
    username, 
    full_name, 
    avatar_url, 
    is_private, 
    is_verified_human,
    level,
    xp
  )
  VALUES (
    new.id, 
    default_username, 
    fullname, 
    avatar, 
    false, -- is_private
    true,  -- is_verified_human
    1,     -- level
    0      -- xp
  );

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error (visible in Supabase database logs) but ideally we don't want to swallow it completely
    -- unless we want to allow auth even if profile creation fails (bad idea for this app).
    -- For now, re-raising to ensure we know it failed.
    RAISE LOG 'Profile creation failed for user %: %', new.id, SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
