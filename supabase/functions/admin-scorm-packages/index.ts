import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPECIAL_ADMIN_ID = '600a8af2-9ccf-4c55-b351-a14e2b5b2221';
const SPECIAL_ADMIN_EMAIL = 'ameh.oche@babbangona.com';

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const resolveAction = async (req: Request, url: URL) => {
  if (req.method === 'GET' && url.pathname.endsWith('/packages')) {
    return { action: 'listPackages' as const, payload: {} as Record<string, unknown> };
  }

  if (req.method === 'POST' && url.pathname.endsWith('/attach')) {
    const payload = await req.json().catch(() => ({}));
    return { action: 'attachPackage' as const, payload };
  }

  if (req.method === 'POST') {
    const payload = await req.json().catch(() => ({}));
    const action = typeof payload?.action === 'string' ? payload.action : 'listPackages';
    return { action, payload };
  }

  return { action: 'unsupported', payload: {} as Record<string, unknown> };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
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
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid authorization token' }, 401);
    }

    const { data: requesterProfile } = await supabaseClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdminRequester =
      requesterProfile?.role === 'admin' ||
      user.id === SPECIAL_ADMIN_ID ||
      user.email === SPECIAL_ADMIN_EMAIL;

    if (!isAdminRequester) {
      return jsonResponse({ error: 'Only admins can manage SCORM packages' }, 403);
    }

    const url = new URL(req.url);
    const { action, payload } = await resolveAction(req, url);

    if (action === 'listPackages') {
      const { data: packages, error } = await supabaseClient
        .from('scorm_packages')
        .select('id, title, version, created_at, is_active, entry_point')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching packages:', error);
        return jsonResponse({ error: error.message }, 400);
      }

      return jsonResponse({ packages: packages || [] });
    }

    if (action === 'attachPackage') {
      const packageId = typeof payload?.packageId === 'string' ? payload.packageId : '';
      const courseId = typeof payload?.courseId === 'string' ? payload.courseId : '';
      const moduleId = typeof payload?.moduleId === 'string' ? payload.moduleId : '';
      const title = typeof payload?.title === 'string' ? payload.title.trim() : '';

      if (!packageId || !courseId || !moduleId) {
        return jsonResponse({ error: 'packageId, courseId and moduleId are required' }, 400);
      }

      const { data: moduleData, error: moduleError } = await supabaseClient
        .from('modules')
        .select('id, course_id')
        .eq('id', moduleId)
        .maybeSingle();

      if (moduleError || !moduleData) {
        console.error('Module lookup error:', moduleError);
        return jsonResponse({ error: 'Module not found' }, 404);
      }

      if (moduleData.course_id !== courseId) {
        return jsonResponse({ error: 'Selected module does not belong to the selected course' }, 400);
      }

      const { data: scormPackage, error: packageError } = await supabaseClient
        .from('scorm_packages')
        .select('id, title, is_active')
        .eq('id', packageId)
        .maybeSingle();

      if (packageError || !scormPackage) {
        console.error('Error fetching package:', packageError);
        return jsonResponse({ error: 'Package not found' }, 404);
      }

      if (!scormPackage.is_active) {
        return jsonResponse({ error: 'Package is inactive and cannot be attached' }, 400);
      }

      const { data: existingLessons, error: sortError } = await supabaseClient
        .from('lessons')
        .select('sort_order')
        .eq('module_id', moduleId)
        .order('sort_order', { ascending: false })
        .limit(1);

      if (sortError) {
        console.error('Sort order lookup error:', sortError);
        return jsonResponse({ error: 'Failed to determine lesson sort order' }, 500);
      }

      const nextSortOrder = ((existingLessons || [])[0]?.sort_order || 0) + 1;

      const { data: lesson, error: lessonError } = await supabaseClient
        .from('lessons')
        .insert({
          module_id: moduleId,
          lesson_kind: 'scorm',
          title: title || `SCORM: ${scormPackage.title}`,
          scorm_package_id: packageId,
          is_required: true,
          sort_order: nextSortOrder,
        })
        .select()
        .single();

      if (lessonError) {
        console.error('Error creating lesson:', lessonError);
        return jsonResponse({ error: lessonError.message }, 400);
      }

      return jsonResponse({ lesson });
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('Unexpected error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
