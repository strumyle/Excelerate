-- Enroll the admin user in a test course so they can see SCORM lessons
INSERT INTO enrollments (user_id, course_id) 
VALUES ('600a8af2-9ccf-4c55-b351-a14e2b5b2221', '046dec4c-90ed-4791-a5d1-fa7fddf0923e')
ON CONFLICT DO NOTHING;