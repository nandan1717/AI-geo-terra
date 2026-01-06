-- Create GDELT Events table
CREATE TABLE IF NOT EXISTS public.gdelt_events (
    id TEXT PRIMARY KEY, -- Stable ID from GDELT (URL hash or similar)
    title TEXT,
    description TEXT,
    source_url TEXT,
    image_url TEXT,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    published_at TIMESTAMPTZ,
    vibe TEXT, -- 'High Energy', 'Chill', etc.
    sentiment FLOAT,
    country TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Pexels Media table
CREATE TABLE IF NOT EXISTS public.pexels_media (
    id BIGINT PRIMARY KEY, -- Pexels ID
    url TEXT, -- Pexels URL
    photographer TEXT,
    image_url TEXT,
    video_url TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gdelt_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pexels_media ENABLE ROW LEVEL SECURITY;

-- Allow public read access (authenticated and anon)
CREATE POLICY "Public read access for gdelt_events"
ON public.gdelt_events FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Public read access for pexels_media"
ON public.pexels_media FOR SELECT TO anon, authenticated
USING (true);

-- Allow service_role to do everything (for Edge Function)
CREATE POLICY "Service role full access for gdelt_events"
ON public.gdelt_events FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access for pexels_media"
ON public.pexels_media FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gdelt_events_created_at ON public.gdelt_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gdelt_events_vibe ON public.gdelt_events(vibe);
CREATE INDEX IF NOT EXISTS idx_pexels_media_created_at ON public.pexels_media(created_at DESC);
