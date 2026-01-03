-- Add post_type column to app_posts table
ALTER TABLE app_posts 
ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'local'; -- local, global, story

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_app_posts_type ON app_posts(post_type);
