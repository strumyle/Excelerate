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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    
    if (req.method === 'GET' && url.pathname.endsWith('/packages')) {
      // List SCORM packages for admins
      const { data: packages, error } = await supabaseClient
        .from('scorm_packages')
        .select('id, title, version, created_at, is_active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching packages:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ packages }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST' && url.pathname.endsWith('/attach')) {
      // Attach SCORM package to course/module
      const { packageId, courseId, moduleId, title } = await req.json();

      if (!packageId || !courseId) {
        return new Response(JSON.stringify({ error: 'Package ID and Course ID are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get package details
      const { data: scormPackage, error: packageError } = await supabaseClient
        .from('scorm_packages')
        .select('title')
        .eq('id', packageId)
        .single();

      if (packageError) {
        console.error('Error fetching package:', packageError);
        return new Response(JSON.stringify({ error: 'Package not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create lesson with SCORM reference
      const { data: lesson, error: lessonError } = await supabaseClient
        .from('lessons')
        .insert({
          module_id: moduleId,
          lesson_kind: 'scorm',
          title: title || `SCORM: ${scormPackage.title}`,
          scorm_package_id: packageId,
          is_required: true,
          sort_order: 0
        })
        .select()
        .single();

      if (lessonError) {
        console.error('Error creating lesson:', lessonError);
        return new Response(JSON.stringify({ error: lessonError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ lesson }), {
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