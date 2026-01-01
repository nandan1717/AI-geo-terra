-- 1. CLEANUP DATA: Personas (AI-generated)
UPDATE public.personas SET handle = 'nomad*kate' WHERE handle = '@nomad_kate';
UPDATE public.personas SET handle = 'tokyo*drift' WHERE handle = '@tokyo_drift';
UPDATE public.personas SET handle = 'eco*sophia' WHERE handle = '@eco_sophia';
UPDATE public.personas SET handle = 'chef*marco' WHERE handle = '@chef_marco';
UPDATE public.personas SET handle = 'lux*luna' WHERE handle = '@lux_luna';
UPDATE public.personas SET handle = 'adventure*alex' WHERE handle = '@adventure_alex';
UPDATE public.personas SET handle = 'art*is*life' WHERE handle = '@art_is_life';
UPDATE public.personas SET handle = 'zen*master' WHERE handle = '@zen_master';

-- Generic cleanup for Personas
UPDATE public.personas
SET handle = REPLACE(REPLACE(LOWER(handle), '@', ''), '_', '*')
WHERE handle LIKE '%@%' OR handle LIKE '%_%';

-- 2. CLEANUP DATA: App Profiles (Real Users)
-- Convert to lowercase
UPDATE public.app_profiles_v2 SET username = LOWER(username);

-- Replace common separators with '*'
UPDATE public.app_profiles_v2 SET username = REPLACE(username, ' ', '*');
UPDATE public.app_profiles_v2 SET username = REPLACE(username, '-', '*');
UPDATE public.app_profiles_v2 SET username = REPLACE(username, '_', '*');
UPDATE public.app_profiles_v2 SET username = REPLACE(username, '@', '');

-- Remove any other invalid characters using Regex (Keep only a-z, 0-9, and *)
UPDATE public.app_profiles_v2 
SET username = REGEXP_REPLACE(username, '[^a-z0-9*]', '', 'g');

-- Safety Check: Ensure no empty usernames resulted from cleanup
UPDATE public.app_profiles_v2
SET username = 'user*' || SUBSTRING(id::text, 1, 8)
WHERE LENGTH(username) < 3; 

-- 3. APPLY CONSTRAINTS
-- Enforce format on AI Personas
ALTER TABLE public.personas
ADD CONSTRAINT check_persona_handle_format 
CHECK (handle ~ '^[a-z0-9*]+$');

-- Enforce format on Users
ALTER TABLE public.app_profiles_v2
ADD CONSTRAINT check_username_format 
CHECK (username ~ '^[a-z0-9*]+$');
