-- Fix storage bucket and RLS issues
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on existing tables that might be missing it
ALTER TABLE public.v_candidate_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_retake_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorial_quiz_questions ENABLE ROW LEVEL SECURITY;