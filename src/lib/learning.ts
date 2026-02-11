import { supabase } from "@/integrations/supabase/client";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string) => UUID_V4_PATTERN.test(value);

export interface Course {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  is_published: boolean;
  thumbnail_url: string | null;
  category: string | null;
  level: string | null;
  created_at: string;
  updated_at: string;
  is_enrolled?: boolean;
}

export interface Chapter {
  id: string;
  course_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CourseModule {
  id: string;
  chapter_id: string;
  title: string;
  type: 'video' | 'article' | 'quiz' | 'embed';
  content_url: string | null;
  duration_minutes: number | null;
  is_required: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  course_id: string;
  user_id: string;
  enrolled_at: string;
}

export interface ModuleProgress {
  id: string;
  module_id: string;
  user_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  score: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  course_id: string;
  user_id: string;
  score: number | null;
  issued_at: string;
  serial: string;
  pdf_path: string | null;
}

export interface EnrollmentProgress {
  enrollment_id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  course_description: string | null;
  course_thumbnail_url?: string | null;
  enrolled_at: string;
  percent_complete: number;
  total_modules: number;
  required_modules: number;
  completed_required: number;
  completed_total: number;
}

// Get user's enrolled courses with progress
export const getMyEnrollments = async (): Promise<EnrollmentProgress[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('vw_enrollment_progress')
    .select('*')
    .eq('user_id', user.id);

  if (error) throw error;
  return data || [];
};

// Get course details with chapters and modules
export const getCourse = async (courseId: string) => {
  const courseLookup = isUuid(courseId)
    ? supabase.from('courses').select('*').eq('id', courseId)
    : supabase.from('courses').select('*').eq('slug', courseId);

  const { data: course, error: courseError } = await courseLookup.single();

  if (courseError) throw courseError;

  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select(`
      *,
      course_modules(*)
    `)
    .eq('course_id', courseId)
    .order('position', { ascending: true });

  if (chaptersError) throw chaptersError;

      // Sort modules within each chapter and cast types
      const sortedChapters = (chapters || []).map(chapter => ({
        ...chapter,
        course_modules: (chapter.course_modules || []).map((module: any) => ({
          ...module,
          type: module.type as 'video' | 'article' | 'quiz' | 'embed'
        })).sort((a: any, b: any) => a.position - b.position)
      }));

  return { course, chapters: sortedChapters };
};

// Get course progress for current user
export const getCourseProgress = async (courseId: string): Promise<EnrollmentProgress | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('vw_enrollment_progress')
    .select('*')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

// Get modules for a course with progress
export const getCourseModules = async (courseId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('course_modules')
    .select(`
      *,
      chapters!inner(course_id),
      progress!left(id, module_id, user_id, status, score, started_at, completed_at)
    `)
    .eq('chapters.course_id', courseId)
    .eq('progress.user_id', user.id)
    .order('position', { ascending: true });

  if (error) throw error;
  return data || [];
};

// Update or create module progress
export const upsertModuleProgress = async (
  moduleId: string, 
  status: 'not_started' | 'in_progress' | 'completed', 
  score?: number
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const updateData: any = {
    module_id: moduleId,
    user_id: user.id,
    status
  };

  if (score !== undefined) {
    updateData.score = score;
  }

  const { data, error } = await supabase
    .from('progress')
    .upsert(updateData, {
      onConflict: 'user_id,module_id'
    });

  if (error) throw error;

  // Log event
  await supabase.from('events').insert({
    user_id: user.id,
    name: 'module_progress_updated',
    properties: { module_id: moduleId, status, score }
  });

  return data;
};

// Get user's certificate for a course
export const getMyCertificate = async (courseId: string): Promise<Certificate | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

// Issue a certificate for a course
export const issueCertificate = async (courseId: string) => {
  const { data, error } = await supabase.functions.invoke('issue-certificate', {
    body: { course_id: courseId }
  });

  if (error) throw error;

  // Log download event when certificate is issued
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('events').insert({
      user_id: user.id,
      name: 'certificate_downloaded',
      properties: { course_id: courseId, serial: data.serial }
    });
  }

  return data;
};

// Enroll in a course
export const enrollInCourse = async (
  courseId: string
): Promise<{ alreadyEnrolled: boolean }> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existingEnrollment, error: existingError } = await supabase
    .from('course_enrollments')
    .select('id')
    .eq('course_id', courseId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingEnrollment) {
    return { alreadyEnrolled: true };
  }

  const { error } = await supabase
    .from('course_enrollments')
    .insert({ course_id: courseId, user_id: user.id });

  if (error) throw error;

  // Log enrollment event
  await supabase.from('events').insert({
    user_id: user.id,
    name: 'course_enrolled',
    properties: { course_id: courseId }
  });

  return { alreadyEnrolled: false };
};

// Get published courses with current user's enrollment status
export const getAvailableCourses = async (searchTerm?: string): Promise<Course[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let coursesQuery = supabase
    .from('courses')
    .select('*')
    .eq('is_active', true)
    .eq('is_published', true);

  if (searchTerm) {
    coursesQuery = coursesQuery.or(
      `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`
    );
  }

  const { data: courses, error: coursesError } = await coursesQuery.order('created_at', { ascending: false });
  if (coursesError) throw coursesError;

  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from('course_enrollments')
    .select('course_id')
    .eq('user_id', user.id);

  if (enrollmentError) throw enrollmentError;

  const enrolledIds = new Set((enrollmentRows || []).map((row) => row.course_id));
  return (courses || []).map((course) => ({
    ...course,
    is_enrolled: enrolledIds.has(course.id),
  }));
};

// Search all published courses
export const searchCourses = async (searchTerm: string): Promise<Course[]> => {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('is_active', true)
    .eq('is_published', true)
    .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`);

  if (error) throw error;
  return data || [];
};

// Get next incomplete required module for resume functionality
export const getNextIncompleteModule = async (courseId: string): Promise<CourseModule | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('course_modules')
    .select(`
      *,
      chapters!inner(course_id, position),
      progress(status)
    `)
    .eq('chapters.course_id', courseId)
    .eq('is_required', true)
    .or('progress.is.null,progress.status.neq.completed')
    .order('chapters.position', { ascending: true })
    .order('position', { ascending: true })
    .limit(1);

  if (error) throw error;
  
  // Cast the type to fix the type error
  const result = data?.[0];
  if (result) {
    return {
      ...result,
      type: result.type as 'video' | 'article' | 'quiz' | 'embed'
    } as CourseModule;
  }
  
  return null;
};
