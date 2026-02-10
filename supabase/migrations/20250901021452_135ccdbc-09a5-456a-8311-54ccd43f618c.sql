-- Create course-thumbnails storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('course-thumbnails', 'course-thumbnails', true);

-- Create storage policies for course thumbnails
CREATE POLICY "Course thumbnail images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'course-thumbnails');

CREATE POLICY "Admins can upload course thumbnails" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'course-thumbnails' AND is_admin());

CREATE POLICY "Admins can update course thumbnails" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'course-thumbnails' AND is_admin());

-- Update courses table to match new requirements
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS level text,
ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS slug text;

-- Create unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS courses_slug_unique ON courses(slug) WHERE slug IS NOT NULL;

-- Create chapters table
CREATE TABLE IF NOT EXISTS public.chapters (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title text NOT NULL,
    position integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for chapters
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- Create policies for chapters
CREATE POLICY "chapters_admin_write" 
ON public.chapters 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "chapters_read" 
ON public.chapters 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM courses c 
    WHERE c.id = chapters.course_id 
    AND (c.is_published OR is_admin())
));

-- Create new course_modules table (different from existing modules)
CREATE TABLE IF NOT EXISTS public.course_modules (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    title text NOT NULL,
    type text NOT NULL CHECK (type IN ('video', 'article', 'quiz', 'embed')),
    content_url text,
    duration_minutes integer,
    is_required boolean NOT NULL DEFAULT true,
    position integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS for course_modules
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;

-- Create policies for course_modules
CREATE POLICY "course_modules_admin_write" 
ON public.course_modules 
FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "course_modules_read" 
ON public.course_modules 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM chapters ch 
    JOIN courses c ON c.id = ch.course_id
    WHERE ch.id = course_modules.chapter_id 
    AND (c.is_published OR is_admin())
));

-- Create triggers for updated_at columns
CREATE TRIGGER update_chapters_updated_at
    BEFORE UPDATE ON public.chapters
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_course_modules_updated_at
    BEFORE UPDATE ON public.course_modules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS chapters_course_id_idx ON chapters(course_id);
CREATE INDEX IF NOT EXISTS chapters_position_idx ON chapters(position);
CREATE INDEX IF NOT EXISTS course_modules_chapter_id_idx ON course_modules(chapter_id);
CREATE INDEX IF NOT EXISTS course_modules_position_idx ON course_modules(position);