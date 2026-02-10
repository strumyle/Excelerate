-- Create enrollments table (renamed from course_enrollments for consistency)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Enable RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Create policies for enrollments
CREATE POLICY "Users can view their own enrollments" 
ON public.enrollments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can enroll themselves" 
ON public.enrollments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all enrollments" 
ON public.enrollments 
FOR ALL 
USING (is_admin());

-- Create progress table for tracking module progress
CREATE TABLE IF NOT EXISTS public.progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
  score NUMERIC,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

-- Create policies for progress
CREATE POLICY "Users can view their own progress" 
ON public.progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" 
ON public.progress 
FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all progress" 
ON public.progress 
FOR ALL 
USING (is_admin());

-- Create trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_progress_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  
  -- Set started_at when status changes from not_started
  IF OLD.status = 'not_started' AND NEW.status IN ('in_progress', 'completed') AND NEW.started_at IS NULL THEN
    NEW.started_at = now();
  END IF;
  
  -- Set completed_at when status changes to completed
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_progress_timestamps
  BEFORE UPDATE ON public.progress
  FOR EACH ROW
  EXECUTE FUNCTION update_progress_timestamps();

-- Create view for course progress summary
CREATE OR REPLACE VIEW public.vw_enrollment_progress AS
SELECT 
  e.id as enrollment_id,
  e.user_id,
  e.course_id,
  c.title as course_title,
  c.description as course_description,
  e.enrolled_at,
  COALESCE(
    ROUND(
      (COUNT(CASE WHEN p.status = 'completed' AND cm.is_required THEN 1 END)::NUMERIC / 
       NULLIF(COUNT(CASE WHEN cm.is_required THEN 1 END), 0)) * 100, 
      2
    ), 0
  ) as percent_complete,
  COUNT(cm.id) as total_modules,
  COUNT(CASE WHEN cm.is_required THEN 1 END) as required_modules,
  COUNT(CASE WHEN p.status = 'completed' AND cm.is_required THEN 1 END) as completed_required,
  COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_total
FROM public.enrollments e
JOIN public.courses c ON c.id = e.course_id
LEFT JOIN public.chapters ch ON ch.course_id = c.id
LEFT JOIN public.course_modules cm ON cm.chapter_id = ch.id
LEFT JOIN public.progress p ON p.module_id = cm.id AND p.user_id = e.user_id
GROUP BY e.id, e.user_id, e.course_id, c.title, c.description, e.enrolled_at;