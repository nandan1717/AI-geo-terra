-- Gamification & Explorer Stats Schema

-- 1. Alter app_profiles_v2 to add Gamification columns
ALTER TABLE public.app_profiles_v2
ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS level integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS region_stats jsonb DEFAULT '{}'::jsonb, -- e.g., {"Canada": 500, "Japan": 1200}
ADD COLUMN IF NOT EXISTS visited_countries jsonb DEFAULT '[]'::jsonb, -- e.g., ["CA", "JP", "FR"]
ADD COLUMN IF NOT EXISTS visited_continents jsonb DEFAULT '[]'::jsonb, -- e.g., ["North America", "Asia"]
ADD COLUMN IF NOT EXISTS visited_regions jsonb DEFAULT '[]'::jsonb; -- e.g., ["British Columbia", "California"]

-- 2. Add XP metadata to Posts (Optional, good for auditing)
ALTER TABLE public.app_posts
ADD COLUMN IF NOT EXISTS xp_earned integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS rarity_score numeric DEFAULT 0, -- 0-10
ADD COLUMN IF NOT EXISTS is_extraordinary boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS region text,
ADD COLUMN IF NOT EXISTS continent text;

-- 3. Function to Calculate Level based on XP
CREATE OR REPLACE FUNCTION calculate_level(xp integer) RETURNS integer AS $$
BEGIN
  -- Simple formula: Level = 1 + floor(xp / 1000)
  RETURN 1 + floor(xp / 1000);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Trigger to auto-update Level when XP changes (Optional, or handle in app logic)
-- We'll handle this in the Application logic for now to show the "Level Up" animation
-- but having a DB trigger is a safe fallback.
CREATE OR REPLACE FUNCTION update_user_level() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.xp <> OLD.xp THEN
    NEW.level := calculate_level(NEW.xp);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_xp_change ON public.app_profiles_v2;

CREATE TRIGGER on_xp_change
  BEFORE UPDATE ON public.app_profiles_v2
  FOR EACH ROW
  EXECUTE PROCEDURE update_user_level();
