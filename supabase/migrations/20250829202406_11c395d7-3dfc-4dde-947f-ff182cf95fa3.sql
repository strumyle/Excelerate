-- 1.1 Enums
CREATE TYPE lesson_type AS ENUM ('video','reading','quiz','external');

-- 1.2 Courses
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.3 Modules
CREATE TABLE IF NOT EXISTS public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.4 Lessons
CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  lesson_kind lesson_type NOT NULL,
  video_url text,
  youtube_url text,
  reading_md text,
  quiz_tutorial_id uuid REFERENCES public.tutorials(id) ON DELETE SET NULL,
  quiz_tutorial_quiz_id uuid,
  external_url text,
  pass_score_percent int,
  duration_minutes int,
  sort_order int NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 1.5 Course Enrollments
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);

-- 1.6 Lesson Progress
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('not_started','in_progress','completed')),
  score numeric,
  completed_at timestamptz,
  last_event_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, user_id)
);

-- 1.7 Certificates
CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  score numeric,
  issued_at timestamptz NOT NULL DEFAULT now(),
  serial text NOT NULL UNIQUE,
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);

-- 1.8 Events table for KPI tracking
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1.9 Helper view: course_progress
CREATE OR REPLACE VIEW public.vw_course_progress AS
SELECT
  ce.user_id,
  c.id AS course_id,
  c.title,
  CASE 
    WHEN count(l.id) = 0 THEN 100
    ELSE round(100.0 * sum((lp.status = 'completed')::int) / count(l.id), 1)
  END AS percent_complete
FROM public.course_enrollments ce
JOIN public.courses c ON c.id = ce.course_id
LEFT JOIN public.modules m ON m.course_id = c.id
LEFT JOIN public.lessons l ON l.module_id = m.id AND l.is_required = true
LEFT JOIN public.lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ce.user_id
GROUP BY ce.user_id, c.id, c.title;

-- 1.10 Certificates metrics view
CREATE OR REPLACE VIEW public.vw_cert_metrics AS
SELECT
  c.id AS course_id,
  c.title,
  count(DISTINCT CASE WHEN e.name='certificate_issued' THEN e.user_id END) AS issued_count,
  count(DISTINCT CASE WHEN e.name='certificate_downloaded' THEN e.user_id END) AS downloaded_count
FROM public.courses c
LEFT JOIN public.events e ON (e.properties->>'course_id')::uuid = c.id
GROUP BY c.id, c.title;

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Helper function for admin check
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  );
$$;

-- RLS Policies
-- Courses
CREATE POLICY "courses_read_active" ON public.courses
FOR SELECT USING (is_active = true OR is_admin());

CREATE POLICY "courses_admin_write" ON public.courses
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Modules
CREATE POLICY "modules_read" ON public.modules
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.courses c 
  WHERE c.id = course_id AND (c.is_active OR is_admin())
));

CREATE POLICY "modules_admin_write" ON public.modules
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Lessons
CREATE POLICY "lessons_read" ON public.lessons
FOR SELECT USING (EXISTS (
  SELECT 1 FROM public.modules m
  JOIN public.courses c ON c.id = m.course_id
  WHERE m.id = module_id AND (c.is_active OR is_admin())
));

CREATE POLICY "lessons_admin_write" ON public.lessons
FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Enrollments
CREATE POLICY "enroll_select_own_or_admin" ON public.course_enrollments
FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "enroll_insert_self" ON public.course_enrollments
FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "enroll_delete_self_or_admin" ON public.course_enrollments
FOR DELETE USING (user_id = auth.uid() OR is_admin());

-- Progress
CREATE POLICY "progress_select_own_or_admin" ON public.lesson_progress
FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "progress_upsert_self" ON public.lesson_progress
FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE POLICY "progress_update_self" ON public.lesson_progress
FOR UPDATE USING (user_id = auth.uid() OR is_admin());

-- Certificates
CREATE POLICY "certs_select_owner_or_admin" ON public.certificates
FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- Events
CREATE POLICY "events_insert_self" ON public.events
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON public.courses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_modules_updated_at
    BEFORE UPDATE ON public.modules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at
    BEFORE UPDATE ON public.lessons
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket setup (will need to be created manually in Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false);

-- Storage policies for certificates bucket
CREATE POLICY "Users can view their own certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role can manage certificates"
ON storage.objects FOR ALL
USING (bucket_id = 'certificates');