import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    console.log('Getting SCORM lessons for user:', user.id);

    const { data: enrolled, error: enrollmentError } = await supabase
      .from("course_enrollments")
      .select("course_id")
      .eq("user_id", user.id);

    if (enrollmentError) {
      console.error('Error fetching enrollments:', enrollmentError);
      throw enrollmentError;
    }

    const courseIds = (enrolled ?? []).map((r: any) => r.course_id).filter(Boolean);
    console.log('User enrolled in courses:', courseIds);

    if (courseIds.length === 0) {
      return jsonResponse({ lessons: [] });
    }

    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select(`
        id,
        title,
        scorm_package_id,
        module_id,
        modules!inner(
          course_id,
          title,
          courses!inner(
            id,
            title
          )
        ),
        scorm_packages(
          id,
          title,
          version,
          entry_point,
          is_active
        )
      `)
      .eq("lesson_kind", "scorm")
      .in("modules.course_id", courseIds)
      .order("title", { ascending: true });

    if (lessonsError) {
      console.error('Error fetching lessons:', lessonsError);
      throw lessonsError;
    }

    const lessonsWithAttempts = await Promise.all(
      (lessons || []).map(async (lesson: any) => {
        const { data: attempts } = await supabase
          .from('scorm_attempts')
          .select('id, status, score_raw, completed_at')
          .eq('package_id', lesson.scorm_package_id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        return {
          ...lesson,
          latest_attempt: attempts?.[0] || null,
        };
      })
    );

    return jsonResponse({ lessons: lessonsWithAttempts });
  } catch (err) {
    console.error("list-scorm-lessons error", err);
    return jsonResponse({ error: String(err?.message ?? err) }, 500);
  }
});
