-- Add SCORM support to lessons table
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS scorm_package_id uuid REFERENCES scorm_packages(id);

-- Add 'scorm' to lesson_kind enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'scorm' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'lesson_kind')) THEN
        ALTER TYPE lesson_kind ADD VALUE 'scorm';
    END IF;
END $$;