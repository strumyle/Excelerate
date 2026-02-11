import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPECIAL_ADMIN_ID = '600a8af2-9ccf-4c55-b351-a14e2b5b2221';
const SPECIAL_ADMIN_EMAIL = 'ameh.oche@babbangona.com';

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const getPackageIdFromPath = (url: URL) => {
  const segments = url.pathname.split('/').filter(Boolean);
  const fnIndex = segments.lastIndexOf('scorm-start');
  if (fnIndex < 0) return null;
  const candidate = segments[fnIndex + 1];
  return candidate || null;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Authorization required' }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: 'Invalid authorization' }, 401);
    }

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const packageIdFromBody =
      typeof body?.packageId === 'string' ? body.packageId.trim() : '';
    const packageId = packageIdFromBody || getPackageIdFromPath(url);

    if (!packageId) {
      return jsonResponse({ error: 'Package ID required' }, 400);
    }

    const { data: requesterProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdminRequester =
      requesterProfile?.role === 'admin' ||
      user.id === SPECIAL_ADMIN_ID ||
      user.email === SPECIAL_ADMIN_EMAIL;

    const { data: packageData, error: packageError } = await supabase
      .from('scorm_packages')
      .select('id, title, version, entry_point, is_active')
      .eq('id', packageId)
      .single();

    if (packageError || !packageData) {
      return jsonResponse({ error: 'Package not found' }, 404);
    }

    if (!isAdminRequester && !packageData.is_active) {
      return jsonResponse({ error: 'Package is inactive' }, 403);
    }

    if (!isAdminRequester) {
      const { data: enrolledCourses, error: enrollmentError } = await supabase
        .from('course_enrollments')
        .select('course_id')
        .eq('user_id', user.id);

      if (enrollmentError) {
        console.error('Enrollment check error:', enrollmentError);
        return jsonResponse({ error: 'Failed to verify enrollment' }, 500);
      }

      const courseIds = (enrolledCourses || []).map((row) => row.course_id).filter(Boolean);
      if (courseIds.length === 0) {
        return jsonResponse({ error: 'Not enrolled for this SCORM content' }, 403);
      }

      const { data: modules, error: moduleError } = await supabase
        .from('modules')
        .select('id')
        .in('course_id', courseIds);

      if (moduleError) {
        console.error('Module lookup error:', moduleError);
        return jsonResponse({ error: 'Failed to verify course linkage' }, 500);
      }

      const moduleIds = (modules || []).map((row) => row.id).filter(Boolean);
      if (moduleIds.length === 0) {
        return jsonResponse({ error: 'No learning modules available for your enrollments' }, 403);
      }

      const { data: linkedLesson, error: linkedLessonError } = await supabase
        .from('lessons')
        .select('id')
        .eq('lesson_kind', 'scorm')
        .eq('scorm_package_id', packageId)
        .in('module_id', moduleIds)
        .limit(1)
        .maybeSingle();

      if (linkedLessonError) {
        console.error('Lesson linkage check error:', linkedLessonError);
        return jsonResponse({ error: 'Failed to verify SCORM lesson access' }, 500);
      }

      if (!linkedLesson) {
        return jsonResponse({ error: 'Not allowed to start this package' }, 403);
      }
    }

    const { data: existingAttempts } = await supabase
      .from('scorm_attempts')
      .select('attempt_no')
      .eq('package_id', packageId)
      .eq('user_id', user.id)
      .order('attempt_no', { ascending: false })
      .limit(1);

    const nextAttemptNo = (existingAttempts?.[0]?.attempt_no || 0) + 1;

    const { data: attemptData, error: attemptError } = await supabase
      .from('scorm_attempts')
      .insert({
        package_id: packageId,
        user_id: user.id,
        attempt_no: nextAttemptNo,
        status: 'not_attempted',
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Attempt creation error:', attemptError);
      return jsonResponse({ error: 'Failed to create attempt' }, 500);
    }

    const initialCmiData = packageData.version === '1.2'
      ? {
          'cmi.core.lesson_status': 'not attempted',
          'cmi.core.lesson_location': '',
          'cmi.suspend_data': '',
          'cmi.core.score.raw': '',
          'cmi.core.score.min': '',
          'cmi.core.score.max': '',
          'cmi.core.session_time': '00:00:00',
        }
      : {
          'cmi.completion_status': 'not attempted',
          'cmi.success_status': 'unknown',
          'cmi.location': '',
          'cmi.suspend_data': '',
          'cmi.score.raw': '',
          'cmi.score.min': '',
          'cmi.score.max': '',
          'cmi.session_time': 'PT0S',
        };

    const { error: cmiError } = await supabase
      .from('scorm_cmi')
      .insert({
        attempt_id: attemptData.id,
        model: initialCmiData,
      });

    if (cmiError) {
      console.error('CMI initialization error:', cmiError);
      return jsonResponse({ error: 'Failed to initialize SCORM state' }, 500);
    }

    return jsonResponse({
      attempt_id: attemptData.id,
      package_id: packageId,
      launch_url: `/learn/scorm/${attemptData.id}`,
      entry_point: packageData.entry_point,
    });
  } catch (error) {
    console.error('Error in scorm-start:', error);
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
});
