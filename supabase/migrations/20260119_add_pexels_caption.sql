-- Add caption column to pexels_media table for DeepSeek-generated captions
ALTER TABLE public.pexels_media ADD COLUMN IF NOT EXISTS caption TEXT;

-- Add index for efficient caption queries
CREATE INDEX IF NOT EXISTS idx_pexels_media_caption ON public.pexels_media(caption) WHERE caption IS NOT NULL;
