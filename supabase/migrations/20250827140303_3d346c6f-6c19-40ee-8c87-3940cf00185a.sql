
-- Add new columns to the tutorials table to support different video types
ALTER TABLE public.tutorials 
ADD COLUMN video_type VARCHAR(20) DEFAULT 'youtube' CHECK (video_type IN ('youtube', 'mp4', 'webm', 'ogg')),
ADD COLUMN video_url TEXT;

-- Update existing records to use the new structure
UPDATE public.tutorials 
SET video_type = 'youtube', 
    video_url = youtube_url 
WHERE youtube_url IS NOT NULL;

-- We'll keep the youtube_url column for backward compatibility but make it nullable
ALTER TABLE public.tutorials 
ALTER COLUMN youtube_url DROP NOT NULL;
