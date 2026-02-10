-- Create tutorial categories table for folder-like grouping
CREATE TABLE public.tutorial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#003296',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add category_id to tutorials table
ALTER TABLE public.tutorials 
ADD COLUMN category_id UUID REFERENCES public.tutorial_categories(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX idx_tutorials_category_id ON public.tutorials(category_id);

-- Enable RLS
ALTER TABLE public.tutorial_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for tutorial_categories
CREATE POLICY "Everyone can view categories" 
ON public.tutorial_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage categories" 
ON public.tutorial_categories 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_tutorial_categories_updated_at
BEFORE UPDATE ON public.tutorial_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();