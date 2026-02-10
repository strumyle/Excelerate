
-- Create tutorials table for admin to manage tutorials
CREATE TABLE tutorials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS on tutorials
ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage tutorials
CREATE POLICY "Admins can manage tutorials" 
ON tutorials 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Policy for candidates to view active tutorials
CREATE POLICY "Users can view active tutorials" 
ON tutorials 
FOR SELECT 
USING (is_active = true);

-- Add function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tutorials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_tutorials_updated_at_trigger
  BEFORE UPDATE ON tutorials
  FOR EACH ROW
  EXECUTE FUNCTION update_tutorials_updated_at();
