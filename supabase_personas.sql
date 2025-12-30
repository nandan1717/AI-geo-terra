
-- Create Personas Table
CREATE TABLE IF NOT EXISTS public.personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    vibe TEXT,
    topics TEXT[], -- Array of strings for search keywords
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.personas
    FOR SELECT USING (true);

-- Allow public insert (for seeding)
CREATE POLICY "Allow public insert" ON public.personas
    FOR INSERT WITH CHECK (true);
