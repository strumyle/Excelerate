-- Update the enrollment progress view to include course thumbnail
DROP VIEW IF EXISTS vw_enrollment_progress;

CREATE VIEW vw_enrollment_progress AS
SELECT 
  e.id as enrollment_id,
  e.user_id,
  e.course_id,
  c.title as course_title,
  c.description as course_description,
  c.thumbnail_url as course_thumbnail_url,
  e.enrolled_at,
  COALESCE(
    ROUND(
      (CAST(COUNT(CASE WHEN mp.status = 'completed' AND cm.is_required THEN 1 END) AS DECIMAL) 
       / NULLIF(COUNT(CASE WHEN cm.is_required THEN 1 END), 0)) * 100, 1
    ), 0
  ) as percent_complete,
  COUNT(cm.id) as total_modules,
  COUNT(CASE WHEN cm.is_required THEN 1 END) as required_modules,
  COUNT(CASE WHEN mp.status = 'completed' AND cm.is_required THEN 1 END) as completed_required,
  COUNT(CASE WHEN mp.status = 'completed' THEN 1 END) as completed_total
FROM course_enrollments e
JOIN courses c ON e.course_id = c.id
LEFT JOIN chapters ch ON ch.course_id = c.id
LEFT JOIN course_modules cm ON cm.chapter_id = ch.id
LEFT JOIN module_progress mp ON mp.module_id = cm.id AND mp.user_id = e.user_id
WHERE c.is_active = true AND c.is_published = true
GROUP BY e.id, e.user_id, e.course_id, c.title, c.description, c.thumbnail_url, e.enrolled_at;