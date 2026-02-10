-- Enable RLS on tables that are missing it
ALTER TABLE IF EXISTS vw_enrollment_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vw_course_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vw_cert_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS v_candidate_scores ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for these views/tables
CREATE POLICY IF NOT EXISTS "enrollment_progress_own_or_admin" 
ON vw_enrollment_progress 
FOR SELECT 
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY IF NOT EXISTS "course_progress_own_or_admin" 
ON vw_course_progress 
FOR SELECT 
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY IF NOT EXISTS "cert_metrics_admin_only" 
ON vw_cert_metrics 
FOR SELECT 
USING (is_admin());

CREATE POLICY IF NOT EXISTS "candidate_scores_own_or_admin" 
ON v_candidate_scores 
FOR SELECT 
USING (user_id = auth.uid() OR is_admin());