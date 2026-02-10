-- Create lesson_kind enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lesson_kind') THEN
        CREATE TYPE lesson_kind AS ENUM ('video', 'reading', 'quiz', 'external', 'scorm');
    ELSE
        -- Add 'scorm' to existing enum if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'scorm' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lesson_kind')) THEN
            ALTER TYPE lesson_kind ADD VALUE 'scorm';
        END IF;
    END IF;
END $$;

-- Add SCORM package reference to lessons table
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS scorm_package_id uuid REFERENCES scorm_packages(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_lessons_scorm_package_id ON lessons(scorm_package_id);