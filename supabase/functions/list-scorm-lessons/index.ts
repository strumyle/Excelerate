import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    // Auth: require a valid user token from the caller
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...cors, "content-type": "application/json" },
        status: 401,
      });
    }

    console.log('Getting SCORM lessons for user:', auth.user.id);

    // Get the learner's enrolled course IDs
    const { data: enrolled, error: e1 } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("user_id", auth.user.id);
    
    if (e1) {
      console.error('Error fetching enrollments:', e1);
      throw e1;
    }

    const courseIds = (enrolled ?? []).map((r: any) => r.course_id);
    console.log('User enrolled in courses:', courseIds);
    
    if (courseIds.length === 0) {
      return new Response(JSON.stringify({ lessons: [] }), {
        headers: { ...cors, "content-type": "application/json" },
        status: 200,
      });
    }

    // Fetch SCORM lessons for those courses
    const { data: lessons, error: e2 } = await supabase
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
          version
        )
      `)
      .eq("lesson_kind", "scorm")
      .in("modules.course_id", courseIds)
      .order("title", { ascending: true });
    
    if (e2) {
      console.error('Error fetching lessons:', e2);
      throw e2;
    }

    console.log('Found SCORM lessons:', lessons?.length || 0);

    // Check for existing attempts for each lesson
    const lessonsWithAttempts = await Promise.all(
      (lessons || []).map(async (lesson) => {
        const { data: attempts } = await supabase
          .from('scorm_attempts')
          .select('id, status, score_raw, completed_at')
          .eq('package_id', lesson.scorm_package_id)
          .eq('user_id', auth.user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        return {
          ...lesson,
          latest_attempt: attempts?.[0] || null
        };
      })
    );

    return new Response(JSON.stringify({ lessons: lessonsWithAttempts }), {
      headers: { ...cors, "content-type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("list-scorm-lessons error", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      headers: { ...cors, "content-type": "application/json" },
      status: 500,
    });
  }
});