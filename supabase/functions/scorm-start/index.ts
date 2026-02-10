import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const packageId = url.pathname.split('/').pop();
    
    if (!packageId) {
      return new Response(JSON.stringify({ error: 'Package ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get user from JWT
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if package exists
    const { data: packageData, error: packageError } = await supabase
      .from('scorm_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (packageError || !packageData) {
      return new Response(JSON.stringify({ error: 'Package not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get next attempt number
    const { data: existingAttempts } = await supabase
      .from('scorm_attempts')
      .select('attempt_no')
      .eq('package_id', packageId)
      .eq('user_id', user.id)
      .order('attempt_no', { ascending: false })
      .limit(1);

    const nextAttemptNo = (existingAttempts?.[0]?.attempt_no || 0) + 1;

    // Create new attempt
    const { data: attemptData, error: attemptError } = await supabase
      .from('scorm_attempts')
      .insert({
        package_id: packageId,
        user_id: user.id,
        attempt_no: nextAttemptNo,
        status: 'not_attempted'
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Attempt creation error:', attemptError);
      return new Response(JSON.stringify({ error: 'Failed to create attempt' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Initialize CMI data
    const initialCmiData = packageData.version === '1.2' ? {
      'cmi.core.lesson_status': 'not attempted',
      'cmi.core.lesson_location': '',
      'cmi.suspend_data': '',
      'cmi.core.score.raw': '',
      'cmi.core.score.min': '',
      'cmi.core.score.max': '',
      'cmi.core.session_time': '00:00:00'
    } : {
      'cmi.completion_status': 'not attempted',
      'cmi.success_status': 'unknown',
      'cmi.location': '',
      'cmi.suspend_data': '',
      'cmi.score.raw': '',
      'cmi.score.min': '',
      'cmi.score.max': '',
      'cmi.session_time': 'PT0S'
    };

    await supabase
      .from('scorm_cmi')
      .insert({
        attempt_id: attemptData.id,
        model: initialCmiData
      });

    return new Response(JSON.stringify({
      attempt_id: attemptData.id,
      package_id: packageId,
      launch_url: `/learn/scorm/${attemptData.id}`,
      entry_point: packageData.entry_point
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('Error in scorm-start:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});