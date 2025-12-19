-- Make image_url nullable to support text-only posts
ALTER TABLE public.app_posts ALTER COLUMN image_url DROP NOT NULL;
