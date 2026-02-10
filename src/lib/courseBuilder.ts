import { supabase } from "@/integrations/supabase/client";

export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail_url?: string;
  category?: string;
  level?: string;
  is_published: boolean;
  slug?: string;
  created_at: string;
  updated_at: string;
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
  content_url?: string;
  duration_minutes?: number;
  is_required: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CourseWithStructure extends Course {
  chapters: (Chapter & {
    modules: CourseModule[];
  })[];
}

// Course CRUD operations
export async function createCourse(courseData: Omit<Course, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('courses')
    .insert([courseData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateCourse(id: string, updates: Partial<Course>) {
  const { data, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteCourse(id: string) {
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function getCourseWithStructure(id: string): Promise<CourseWithStructure> {
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();
  
  if (courseError) throw courseError;

  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('*')
    .eq('course_id', id)
    .order('position');
  
  if (chaptersError) throw chaptersError;

  const chaptersWithModules = await Promise.all(
    chapters.map(async (chapter) => {
      const { data: modules, error: modulesError } = await supabase
        .from('course_modules')
        .select('*')
        .eq('chapter_id', chapter.id)
        .order('position');
      
      if (modulesError) throw modulesError;
      
      return {
        ...chapter,
        modules: (modules || []).map(module => ({
          ...module,
          type: module.type as CourseModule['type']
        }))
      };
    })
  );

  return {
    ...course,
    chapters: chaptersWithModules
  };
}

export async function getAllCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Chapter CRUD operations
export async function createChapter(chapterData: Omit<Chapter, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('chapters')
    .insert([chapterData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateChapter(id: string, updates: Partial<Chapter>) {
  const { data, error } = await supabase
    .from('chapters')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteChapter(id: string) {
  const { error } = await supabase
    .from('chapters')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// Module CRUD operations
export async function createModule(moduleData: Omit<CourseModule, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('course_modules')
    .insert([moduleData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateModule(id: string, updates: Partial<CourseModule>) {
  const { data, error } = await supabase
    .from('course_modules')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteModule(id: string) {
  const { error } = await supabase
    .from('course_modules')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// Reordering functions
export async function reorderChapters(courseId: string, chapterIds: string[]) {
  const updates = chapterIds.map((id, index) => ({ id, position: index }));
  
  for (const update of updates) {
    await supabase
      .from('chapters')
      .update({ position: update.position })
      .eq('id', update.id);
  }
}

export async function reorderModules(chapterId: string, moduleIds: string[]) {
  const updates = moduleIds.map((id, index) => ({ id, position: index }));
  
  for (const update of updates) {
    await supabase
      .from('course_modules')
      .update({ position: update.position })
      .eq('id', update.id);
  }
}

// File upload function
export async function uploadCourseThumbnail(file: File, courseId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${courseId}/thumbnail.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('course-thumbnails')
    .upload(fileName, file, { upsert: true });
  
  if (error) throw error;
  
  const { data: { publicUrl } } = supabase.storage
    .from('course-thumbnails')
    .getPublicUrl(fileName);
  
  return publicUrl;
}