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
    const attemptId = url.searchParams.get('attemptId');
    const filePath = url.searchParams.get('file') || '';

    if (!attemptId) {
      return new Response('Attempt ID required', { status: 400 });
    }

    // Verify user has access to this attempt
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );
      
      if (user) {
        const { data: attemptData } = await supabase
          .from('scorm_attempts')
          .select(`
            *,
            scorm_packages(storage_prefix, entry_point)
          `)
          .eq('id', attemptId)
          .eq('user_id', user.id)
          .single();

        if (!attemptData) {
          return new Response('Unauthorized', { status: 403 });
        }

        const storagePrefix = attemptData.scorm_packages?.storage_prefix;
        const entryPoint = attemptData.scorm_packages?.entry_point;
        
        // If no specific file requested, serve the entry point
        const targetFile = filePath || entryPoint || 'index.html';
        const fullPath = `${storagePrefix}${targetFile}`;

        // Get signed URL for the file
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('scorm-packages')
          .createSignedUrl(fullPath, 3600); // 1 hour expiry

        if (signedUrlError || !signedUrlData?.signedUrl) {
          // For demo, return a basic HTML page if file not found
          const demoContent = `
<!DOCTYPE html>
<html>
<head>
    <title>SCORM Content</title>
    <script>
        // SCORM API detection
        function findAPI(win) {
            let attempts = 0;
            while (win && attempts < 10) {
                if (win.API || win.API_1484_11) {
                    return win.API || win.API_1484_11;
                }
                if (win.parent && win.parent !== win) {
                    win = win.parent;
                } else if (win.opener) {
                    win = win.opener;
                } else {
                    break;
                }
                attempts++;
            }
            return null;
        }

        window.addEventListener('load', function() {
            const api = findAPI(window);
            if (api) {
                console.log('SCORM API found');
                // Initialize
                if (api.LMSInitialize) {
                    api.LMSInitialize('');
                    api.LMSSetValue('cmi.core.lesson_status', 'incomplete');
                } else if (api.Initialize) {
                    api.Initialize('');
                    api.SetValue('cmi.completion_status', 'incomplete');
                }
            } else {
                console.log('SCORM API not found');
            }
        });
    </script>
</head>
<body>
    <h1>Demo SCORM Content</h1>
    <p>This is a demonstration SCORM package.</p>
    <button onclick="markComplete()">Complete Course</button>
    
    <script>
        function markComplete() {
            const api = findAPI(window);
            if (api) {
                if (api.LMSSetValue) {
                    api.LMSSetValue('cmi.core.lesson_status', 'completed');
                    api.LMSSetValue('cmi.core.score.raw', '100');
                    api.LMSFinish('');
                } else if (api.SetValue) {
                    api.SetValue('cmi.completion_status', 'completed');
                    api.SetValue('cmi.success_status', 'passed');
                    api.SetValue('cmi.score.raw', '100');
                    api.Terminate('');
                }
                alert('Course completed!');
            }
        }
    </script>
</body>
</html>`;
          
          return new Response(demoContent, {
            headers: { 'Content-Type': 'text/html', ...corsHeaders }
          });
        }

        // Redirect to signed URL
        return Response.redirect(signedUrlData.signedUrl, 302);
      }
    }

    return new Response('Unauthorized', { status: 401 });

  } catch (error) {
    console.error('Error in scorm-file:', error);
    return new Response('Internal server error', { status: 500 });
  }
});