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
    const pathParts = url.pathname.split('/');
    const attemptId = pathParts[pathParts.length - 2];
    const action = pathParts[pathParts.length - 1];

    if (!attemptId || !action) {
      return new Response(JSON.stringify({ error: 'Invalid request path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get attempt and CMI data
    const { data: attemptData, error: attemptError } = await supabase
      .from('scorm_attempts')
      .select(`
        *,
        scorm_packages(*),
        scorm_cmi(*)
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError || !attemptData) {
      return new Response(JSON.stringify({ error: 'Attempt not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const cmiData = attemptData.scorm_cmi?.[0]?.model || {};
    const packageData = attemptData.scorm_packages;

    let response: any = { success: true };

    switch (action) {
      case 'initialize':
        // Update attempt status
        await supabase
          .from('scorm_attempts')
          .update({ 
            status: 'in_progress',
            started_at: new Date().toISOString()
          })
          .eq('id', attemptId);
        
        response = { success: true, errorCode: "0" };
        break;

      case 'getValue':
        const { key } = await req.json();
        const value = cmiData[key] || '';
        response = { success: true, value, errorCode: "0" };
        break;

      case 'setValue':
        const { key: setKey, value: setValue } = await req.json();
        const updatedCmiData = { ...cmiData, [setKey]: setValue };
        
        await supabase
          .from('scorm_cmi')
          .update({ model: updatedCmiData })
          .eq('attempt_id', attemptId);
        
        response = { success: true, errorCode: "0" };
        break;

      case 'commit':
        // Save current CMI data (already saved in setValue)
        response = { success: true, errorCode: "0" };
        break;

      case 'terminate':
        // Calculate final scores and completion status
        const isScorm12 = packageData?.version === '1.2';
        let finalStatus = 'incomplete';
        let completedAt = null;
        
        if (isScorm12) {
          const lessonStatus = cmiData['cmi.core.lesson_status'];
          if (lessonStatus === 'completed' || lessonStatus === 'passed') {
            finalStatus = 'completed';
            completedAt = new Date().toISOString();
          }
        } else {
          const completionStatus = cmiData['cmi.completion_status'];
          const successStatus = cmiData['cmi.success_status'];
          if (completionStatus === 'completed' || successStatus === 'passed') {
            finalStatus = 'completed';
            completedAt = new Date().toISOString();
          }
        }

        // Parse session time and add to total time
        const sessionTime = isScorm12 ? 
          cmiData['cmi.core.session_time'] : 
          cmiData['cmi.session_time'];
        
        // Update attempt with final data
        await supabase
          .from('scorm_attempts')
          .update({
            status: finalStatus,
            score_raw: parseFloat(cmiData[isScorm12 ? 'cmi.core.score.raw' : 'cmi.score.raw']) || null,
            score_min: parseFloat(cmiData[isScorm12 ? 'cmi.core.score.min' : 'cmi.score.min']) || null,
            score_max: parseFloat(cmiData[isScorm12 ? 'cmi.core.score.max' : 'cmi.score.max']) || null,
            completed_at: completedAt
          })
          .eq('id', attemptId);
        
        response = { 
          success: true, 
          errorCode: "0",
          completed: finalStatus === 'completed'
        };
        break;

      default:
        response = { success: false, errorCode: "101", errorString: "Invalid action" };
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('Error in scorm-runtime:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      errorCode: "101"
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});