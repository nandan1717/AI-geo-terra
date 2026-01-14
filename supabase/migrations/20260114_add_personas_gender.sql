-- Migration: Add missing gender column to personas table
-- Run this in the Supabase SQL Editor

-- Add gender column if it doesn't exist
ALTER TABLE public.personas 
ADD COLUMN IF NOT EXISTS gender TEXT;

-- Add other useful columns that might be missing
ALTER TABLE public.personas 
ADD COLUMN IF NOT EXISTS age INTEGER;

ALTER TABLE public.personas 
ADD COLUMN IF NOT EXISTS occupation TEXT;

ALTER TABLE public.personas 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Update existing records with default values if needed
UPDATE public.personas 
SET gender = 'Unknown' 
WHERE gender IS NULL;
