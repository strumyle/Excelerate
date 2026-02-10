
-- Create table for tutorial quiz questions
CREATE TABLE tutorial_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id UUID NOT NULL REFERENCES tutorials(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create table to track candidate quiz attempts
CREATE TABLE tutorial_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id UUID NOT NULL REFERENCES tutorials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  time_spent_seconds INTEGER NOT NULL,
  answers JSONB NOT NULL, -- Store question_id -> selected_answer mapping
  category_breakdown JSONB, -- Store performance by category/topic
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE tutorial_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutorial_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for tutorial quiz questions
CREATE POLICY "Admins can manage tutorial quiz questions" 
ON tutorial_quiz_questions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Users can view tutorial quiz questions" 
ON tutorial_quiz_questions 
FOR SELECT 
USING (true);

-- Policies for tutorial quiz attempts
CREATE POLICY "Admins can view all tutorial quiz attempts" 
ON tutorial_quiz_attempts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Users can view their own tutorial quiz attempts" 
ON tutorial_quiz_attempts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tutorial quiz attempts" 
ON tutorial_quiz_attempts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);
