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

const getRouteParams = (url: URL) => {
  const segments = url.pathname.split('/').filter(Boolean);
  const fnIndex = segments.lastIndexOf('scorm-runtime');
  if (fnIndex < 0) return { attemptId: null, action: null };
  return {
    attemptId: segments[fnIndex + 1] || null,
    action: segments[fnIndex + 2] || null,
  };
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed', errorCode: '405' }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return jsonResponse({ success: false, error: 'Authorization required', errorCode: '401' }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ success: false, error: 'Invalid authorization', errorCode: '401' }, 401);
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

    const url = new URL(req.url);
    const { attemptId, action } = getRouteParams(url);

    if (!attemptId || !action) {
      return jsonResponse({ success: false, error: 'Invalid request path', errorCode: '400' }, 400);
    }

    const { data: attemptData, error: attemptError } = await supabase
      .from('scorm_attempts')
      .select(`
        id,
        user_id,
        status,
        started_at,
        package_id,
        scorm_packages(version),
        scorm_cmi(id, model)
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError || !attemptData) {
      return jsonResponse({ success: false, error: 'Attempt not found', errorCode: '404' }, 404);
    }

    if (!isAdminRequester && attemptData.user_id !== user.id) {
      return jsonResponse({ success: false, error: 'Not allowed to access this attempt', errorCode: '403' }, 403);
    }

    const cmiRow = attemptData.scorm_cmi?.[0];
    if (!cmiRow) {
      return jsonResponse({ success: false, error: 'CMI state not found for attempt', errorCode: '404' }, 404);
    }

    const cmiData =
      cmiRow.model && typeof cmiRow.model === 'object' && !Array.isArray(cmiRow.model)
        ? (cmiRow.model as Record<string, string>)
        : {};

    let response: Record<string, unknown> = { success: true, errorCode: '0' };

    if (action === 'initialize') {
      const nextStartedAt = attemptData.started_at || new Date().toISOString();
      await supabase
        .from('scorm_attempts')
        .update({
          status: 'in_progress',
          started_at: nextStartedAt,
        })
        .eq('id', attemptId);

      return jsonResponse(response);
    }

    if (action === 'getValue') {
      const body = await req.json().catch(() => ({}));
      const key = typeof body?.key === 'string' ? body.key : '';
      if (!key) {
        return jsonResponse({ success: false, errorCode: '201', errorString: 'CMI key required' }, 400);
      }

      return jsonResponse({ success: true, value: cmiData[key] || '', errorCode: '0' });
    }

    if (action === 'setValue') {
      const body = await req.json().catch(() => ({}));
      const setKey = typeof body?.key === 'string' ? body.key : '';
      const setValue = typeof body?.value === 'string' ? body.value : String(body?.value ?? '');

      if (!setKey) {
        return jsonResponse({ success: false, errorCode: '201', errorString: 'CMI key required' }, 400);
      }

      const updatedCmiData = { ...cmiData, [setKey]: setValue };
      const { error: setError } = await supabase
        .from('scorm_cmi')
        .update({ model: updatedCmiData })
        .eq('attempt_id', attemptId);

      if (setError) {
        console.error('CMI setValue error:', setError);
        return jsonResponse({ success: false, errorCode: '101', errorString: 'Failed to save CMI value' }, 500);
      }

      return jsonResponse(response);
    }

    if (action === 'commit') {
      return jsonResponse(response);
    }

    if (action === 'terminate') {
      const { data: latestCmiRow, error: latestCmiError } = await supabase
        .from('scorm_cmi')
        .select('model')
        .eq('attempt_id', attemptId)
        .maybeSingle();

      if (latestCmiError) {
        console.error('CMI terminate load error:', latestCmiError);
      }

      const latestCmi =
        latestCmiRow?.model && typeof latestCmiRow.model === 'object' && !Array.isArray(latestCmiRow.model)
          ? (latestCmiRow.model as Record<string, string>)
          : cmiData;

      const isScorm12 = attemptData.scorm_packages?.version === '1.2';

      let isCompleted = false;
      if (isScorm12) {
        const lessonStatus = (latestCmi['cmi.core.lesson_status'] || '').toLowerCase();
        isCompleted = ['completed', 'passed', 'failed'].includes(lessonStatus);
      } else {
        const completionStatus = (latestCmi['cmi.completion_status'] || '').toLowerCase();
        const successStatus = (latestCmi['cmi.success_status'] || '').toLowerCase();
        isCompleted = completionStatus === 'completed' || ['passed', 'failed'].includes(successStatus);
      }

      const scoreRawKey = isScorm12 ? 'cmi.core.score.raw' : 'cmi.score.raw';
      const scoreMinKey = isScorm12 ? 'cmi.core.score.min' : 'cmi.score.min';
      const scoreMaxKey = isScorm12 ? 'cmi.core.score.max' : 'cmi.score.max';

      const parseOptionalNumber = (value: string | undefined) => {
        if (typeof value !== 'string' || !value.trim()) return null;
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const nextStatus = isCompleted ? 'completed' : 'incomplete';
      const { error: terminateError } = await supabase
        .from('scorm_attempts')
        .update({
          status: nextStatus,
          score_raw: parseOptionalNumber(latestCmi[scoreRawKey]),
          score_min: parseOptionalNumber(latestCmi[scoreMinKey]),
          score_max: parseOptionalNumber(latestCmi[scoreMaxKey]),
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', attemptId);

      if (terminateError) {
        console.error('Terminate update error:', terminateError);
        return jsonResponse({ success: false, errorCode: '101', errorString: 'Failed to finalize attempt' }, 500);
      }

      response = {
        success: true,
        errorCode: '0',
        completed: isCompleted,
        status: nextStatus,
      };
      return jsonResponse(response);
    }

    return jsonResponse({ success: false, errorCode: '101', errorString: 'Invalid action' }, 400);
  } catch (error) {
    console.error('Error in scorm-runtime:', error);
    return jsonResponse(
      {
        success: false,
        error: error.message || 'Internal server error',
        errorCode: '101',
      },
      500
    );
  }
});
