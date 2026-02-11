-- Backfill legacy enrollments into course_enrollments so existing learners appear in My Courses.

INSERT INTO public.course_enrollments (course_id, user_id, enrolled_at)
SELECT e.course_id, e.user_id, e.enrolled_at
FROM public.enrollments e
LEFT JOIN public.course_enrollments ce
  ON ce.course_id = e.course_id
 AND ce.user_id = e.user_id
WHERE ce.id IS NULL;
