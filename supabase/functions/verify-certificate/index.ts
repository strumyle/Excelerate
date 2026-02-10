import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const serial = url.searchParams.get('serial');

    if (!serial) {
      return new Response(
        JSON.stringify({ error: 'Serial parameter is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Use service role to bypass RLS for verification
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get certificate details
    const { data: certificate, error } = await supabaseAdmin
      .from('certificates')
      .select(`
        serial,
        score,
        issued_at,
        course_id,
        user_id,
        courses(title),
        users(full_name)
      `)
      .eq('serial', serial)
      .single();

    if (error || !certificate) {
      return new Response(
        JSON.stringify({ 
          error: 'Certificate not found or invalid',
          valid: false 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Return minimal verification data
    const verificationData = {
      valid: true,
      serial: certificate.serial,
      course_title: certificate.courses?.title || 'Unknown Course',
      user_full_name: certificate.users?.full_name || 'Unknown User',
      issued_at: certificate.issued_at,
      score: certificate.score
    };

    return new Response(
      JSON.stringify(verificationData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in verify-certificate function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        valid: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});