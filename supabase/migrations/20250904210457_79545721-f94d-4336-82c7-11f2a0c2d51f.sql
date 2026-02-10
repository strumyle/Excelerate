-- Create SCORM support tables
CREATE TABLE public.scorm_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  version TEXT NOT NULL CHECK (version IN ('1.2', '2004')),
  entry_point TEXT NOT NULL,
  manifest_json JSONB NOT NULL DEFAULT '{}',
  storage_prefix TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.scorm_scos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.scorm_packages(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  title TEXT NOT NULL,
  launch_href TEXT NOT NULL,
  mastery_score TEXT,
  prerequisites TEXT,
  data_from_lms TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.scorm_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.scorm_packages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  attempt_no INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'not_attempted',
  score_raw NUMERIC,
  score_min NUMERIC,
  score_max NUMERIC,
  total_time INTERVAL DEFAULT '0 seconds',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(package_id, user_id, attempt_no)
);

CREATE TABLE public.scorm_cmi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.scorm_attempts(id) ON DELETE CASCADE,
  model JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(attempt_id)
);

-- Enable RLS
ALTER TABLE public.scorm_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorm_scos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorm_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorm_cmi ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scorm_packages
CREATE POLICY "scorm_packages_admin_all" ON public.scorm_packages
  FOR ALL USING (is_admin());

CREATE POLICY "scorm_packages_read_active" ON public.scorm_packages
  FOR SELECT USING (is_active = true OR is_admin());

-- RLS Policies for scorm_scos
CREATE POLICY "scorm_scos_admin_all" ON public.scorm_scos
  FOR ALL USING (is_admin());

CREATE POLICY "scorm_scos_read" ON public.scorm_scos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.scorm_packages sp
      WHERE sp.id = scorm_scos.package_id 
      AND (sp.is_active = true OR is_admin())
    )
  );

-- RLS Policies for scorm_attempts
CREATE POLICY "scorm_attempts_admin_all" ON public.scorm_attempts
  FOR ALL USING (is_admin());

CREATE POLICY "scorm_attempts_user_own" ON public.scorm_attempts
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for scorm_cmi
CREATE POLICY "scorm_cmi_admin_all" ON public.scorm_cmi
  FOR ALL USING (is_admin());

CREATE POLICY "scorm_cmi_user_own" ON public.scorm_cmi
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.scorm_attempts sa
      WHERE sa.id = scorm_cmi.attempt_id 
      AND sa.user_id = auth.uid()
    )
  );

-- Create storage bucket for SCORM packages
INSERT INTO storage.buckets (id, name, public) VALUES ('scorm-packages', 'scorm-packages', false);

-- Storage policies for SCORM packages
CREATE POLICY "scorm_storage_admin_all" ON storage.objects
  FOR ALL USING (bucket_id = 'scorm-packages' AND is_admin());

CREATE POLICY "scorm_storage_user_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'scorm-packages' AND 
    EXISTS (
      SELECT 1 FROM public.scorm_attempts sa
      WHERE sa.user_id = auth.uid()
      AND (storage.foldername(name))[1] = sa.package_id::text
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER update_scorm_packages_updated_at
  BEFORE UPDATE ON public.scorm_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scorm_attempts_updated_at  
  BEFORE UPDATE ON public.scorm_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scorm_cmi_updated_at
  BEFORE UPDATE ON public.scorm_cmi
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();