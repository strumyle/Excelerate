
-- Add unit column to test_submissions for better grouping
ALTER TABLE test_submissions 
ADD COLUMN unit TEXT;

-- Add result release control to tests
ALTER TABLE tests 
ADD COLUMN results_released BOOLEAN DEFAULT false;

-- Add retake permissions tracking
CREATE TABLE IF NOT EXISTS test_retake_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  test_id UUID NOT NULL,
  granted_by UUID NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reason TEXT,
  UNIQUE(user_id, test_id)
);

-- Enable RLS on retake permissions
ALTER TABLE test_retake_permissions ENABLE ROW LEVEL SECURITY;

-- Create policy for retake permissions
CREATE POLICY "Admins can manage retake permissions" 
ON test_retake_permissions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create policy for users to view their own retake permissions
CREATE POLICY "Users can view their retake permissions" 
ON test_retake_permissions 
FOR SELECT 
USING (user_id = auth.uid());
