import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('learner-scorm-lessons function called');
    
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.log('No authorization header found');
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    console.log('User auth result:', { user: user?.id, error: userError });
    
    if (userError || !user) {
      console.log('User authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET') {
      console.log('Getting SCORM lessons for user:', user.id);
      
      // Get SCORM lessons for enrolled courses
      const { data: lessons, error } = await supabaseClient
        .from('lessons')
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
              title,
              enrollments!inner(user_id)
            )
          ),
          scorm_packages(
            id,
            title,
            version
          )
        `)
        .eq('lesson_kind', 'scorm')
        .eq('modules.courses.enrollments.user_id', user.id);

      console.log('Lessons query result:', { lessons: lessons?.length, error });

      if (error) {
        console.error('Error fetching SCORM lessons:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Processing', lessons?.length || 0, 'lessons');

      // Check for existing attempts for each lesson
      const lessonsWithAttempts = await Promise.all(
        (lessons || []).map(async (lesson) => {
          const { data: attempts } = await supabaseClient
            .from('scorm_attempts')
            .select('id, status, score_raw, completed_at')
            .eq('package_id', lesson.scorm_package_id)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1);

          return {
            ...lesson,
            latest_attempt: attempts?.[0] || null
          };
        })
      );

      console.log('Returning lessons with attempts:', lessonsWithAttempts.length);

      return new Response(JSON.stringify({ lessons: lessonsWithAttempts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});