import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { ulid } from "https://deno.land/x/ulid@v0.3.0/mod.ts";

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
    const { course_id } = await req.json();

    if (!course_id) {
      return new Response(
        JSON.stringify({ error: 'Course ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create supabase client with user's JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { authorization: authHeader },
        },
      }
    );

    // Get user from JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is enrolled in course
    const { data: enrollment } = await supabase
      .from('course_enrollments')
      .select('*')
      .eq('course_id', course_id)
      .eq('user_id', user.id)
      .single();

    if (!enrollment) {
      return new Response(
        JSON.stringify({ error: 'User not enrolled in this course' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check course completion using the view
    const { data: progress } = await supabase
      .from('vw_course_progress')
      .select('*')
      .eq('course_id', course_id)
      .eq('user_id', user.id)
      .single();

    if (!progress || progress.percent_complete < 100) {
      return new Response(
        JSON.stringify({ 
          error: 'Course not completed. Current progress: ' + (progress?.percent_complete || 0) + '%'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if certificate already exists
    const { data: existingCert } = await supabase
      .from('certificates')
      .select('serial, pdf_path')
      .eq('course_id', course_id)
      .eq('user_id', user.id)
      .single();

    if (existingCert) {
      // Return existing certificate
      const { data: signedUrl } = await supabase.storage
        .from('certificates')
        .createSignedUrl(existingCert.pdf_path!, 3600); // 1 hour expiry

      return new Response(
        JSON.stringify({
          serial: existingCert.serial,
          pdf_url: signedUrl?.signedUrl,
          course_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get course and user details for certificate
    const { data: course } = await supabase
      .from('courses')
      .select('title')
      .eq('id', course_id)
      .single();

    const { data: userProfile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single();

    // Generate new certificate
    const serial = ulid();
    const publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL') || 'https://excelerate.yourdomain.com';

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Certificate content
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Title
    page.drawText('CERTIFICATE OF COMPLETION', {
      x: 150,
      y: 650,
      size: 24,
      font: boldFont,
      color: rgb(0, 0.4, 0.8),
    });

    // Excelerate branding
    page.drawText('Excelerate Learning Platform', {
      x: 220,
      y: 600,
      size: 16,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Certificate text
    page.drawText('This certifies that', {
      x: 250,
      y: 520,
      size: 14,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Student name
    page.drawText(userProfile?.full_name || 'Student', {
      x: 220,
      y: 480,
      size: 20,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Course completion text
    page.drawText('has successfully completed the course', {
      x: 180,
      y: 440,
      size: 14,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Course title
    const courseTitle = course?.title || 'Unknown Course';
    page.drawText(courseTitle, {
      x: 306 - (courseTitle.length * 4), // Center approximately
      y: 400,
      size: 16,
      font: boldFont,
      color: rgb(0, 0.4, 0.8),
    });

    // Date
    page.drawText(`Issued on: ${currentDate}`, {
      x: 240,
      y: 320,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Serial number
    page.drawText(`Certificate ID: ${serial}`, {
      x: 230,
      y: 280,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Verification URL
    const verifyUrl = `${publicSiteUrl}/verify/${serial}`;
    page.drawText(`Verify at: ${verifyUrl}`, {
      x: 160,
      y: 240,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Upload PDF to storage
    const pdfPath = `${user.id}/${serial}.pdf`;
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { error: uploadError } = await supabaseAdmin.storage
      .from('certificates')
      .upload(pdfPath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('PDF upload error:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate certificate' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert certificate record
    const { error: dbError } = await supabase
      .from('certificates')
      .insert({
        course_id,
        user_id: user.id,
        serial,
        pdf_path: pdfPath,
        score: progress.percent_complete
      });

    if (dbError) {
      console.error('Database insert error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Failed to create certificate record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log event
    await supabase.from('events').insert({
      user_id: user.id,
      name: 'certificate_issued',
      properties: { course_id, serial }
    });

    // Get signed URL for download
    const { data: signedUrl } = await supabase.storage
      .from('certificates')
      .createSignedUrl(pdfPath, 3600); // 1 hour expiry

    return new Response(
      JSON.stringify({
        serial,
        pdf_url: signedUrl?.signedUrl,
        course_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in issue-certificate function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});