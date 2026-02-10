import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScormManifest {
  version: string;
  organizations: Array<{
    identifier: string;
    title: string;
    items: Array<{
      identifier: string;
      title: string;
      resource: string;
    }>;
  }>;
  resources: Array<{
    identifier: string;
    href: string;
    type: string;
  }>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Generate package ID
    const packageId = crypto.randomUUID();
    const storagePrefix = `${packageId}/`;

    // Read and extract ZIP file
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // For demo purposes, let's assume we have the manifest data
    // In a real implementation, you'd extract the ZIP and parse imsmanifest.xml
    const manifestData: ScormManifest = {
      version: '1.2',
      organizations: [{
        identifier: 'default_org',
        title: file.name.replace('.zip', ''),
        items: [{
          identifier: 'item_1',
          title: 'Main Content',
          resource: 'resource_1'
        }]
      }],
      resources: [{
        identifier: 'resource_1',
        href: 'index.html',
        type: 'webcontent'
      }]
    };

    // Upload ZIP file to storage
    const { error: uploadError } = await supabase.storage
      .from('scorm-packages')
      .upload(`${storagePrefix}package.zip`, uint8Array, {
        contentType: 'application/zip'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to upload package' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Create package record
    const { data: packageData, error: packageError } = await supabase
      .from('scorm_packages')
      .insert({
        id: packageId,
        title: manifestData.organizations[0]?.title || file.name.replace('.zip', ''),
        version: manifestData.version,
        entry_point: manifestData.resources[0]?.href || 'index.html',
        manifest_json: manifestData,
        storage_prefix: storagePrefix,
        created_by: req.headers.get('user-id')
      })
      .select()
      .single();

    if (packageError) {
      console.error('Package creation error:', packageError);
      return new Response(JSON.stringify({ error: 'Failed to create package record' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Create SCO records
    const scoData = manifestData.organizations[0]?.items.map(item => {
      const resource = manifestData.resources.find(r => r.identifier === item.resource);
      return {
        package_id: packageId,
        identifier: item.identifier,
        title: item.title,
        launch_href: resource?.href || 'index.html'
      };
    }) || [];

    if (scoData.length > 0) {
      const { error: scoError } = await supabase
        .from('scorm_scos')
        .insert(scoData);

      if (scoError) {
        console.error('SCO creation error:', scoError);
      }
    }

    return new Response(JSON.stringify({
      package_id: packageId,
      title: packageData.title,
      version: packageData.version,
      entry_point: packageData.entry_point
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('Error in scorm-upload:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});