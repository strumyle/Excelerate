-- Add 'scorm' to lesson_type enum
ALTER TYPE lesson_type ADD VALUE IF NOT EXISTS 'scorm';

-- Check the actual column structure of lessons table
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'lessons' 
AND column_name IN ('lesson_kind', 'lesson_type', 'kind', 'type')
ORDER BY column_name;