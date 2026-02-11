import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import JSZip from 'https://esm.sh/jszip@3.10.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPECIAL_ADMIN_ID = '600a8af2-9ccf-4c55-b351-a14e2b5b2221';
const SPECIAL_ADMIN_EMAIL = 'ameh.oche@babbangona.com';

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
  entryPoint: string;
  title: string;
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const sanitizeZipPath = (path: string) => {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!normalized) return null;
  if (normalized.includes('..') || normalized.includes('\0')) return null;
  return normalized;
};

const inferContentType = (path: string) => {
  const lower = path.toLowerCase();

  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html; charset=utf-8';
  if (lower.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (lower.endsWith('.css')) return 'text/css; charset=utf-8';
  if (lower.endsWith('.json')) return 'application/json; charset=utf-8';
  if (lower.endsWith('.xml')) return 'application/xml; charset=utf-8';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.woff2')) return 'font/woff2';

  return 'application/octet-stream';
};

const textContent = (element: Element | null) => element?.textContent?.trim() || '';

const parseManifest = (manifestXml: string, fallbackTitle: string): ScormManifest => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(manifestXml, 'application/xml');

  if (!doc || doc.querySelector('parsererror')) {
    throw new Error('Invalid imsmanifest.xml content.');
  }

  const manifestEl = doc.querySelector('manifest');
  if (!manifestEl) {
    throw new Error('imsmanifest.xml does not contain <manifest>.');
  }

  const resources = Array.from(doc.getElementsByTagName('resource')).map((resourceNode) => ({
    identifier: resourceNode.getAttribute('identifier') || '',
    href: resourceNode.getAttribute('href') || '',
    type: resourceNode.getAttribute('type') || 'webcontent',
  }));

  if (resources.length === 0) {
    throw new Error('imsmanifest.xml has no <resource> entries.');
  }

  const organizations = Array.from(doc.getElementsByTagName('organization')).map((orgNode) => ({
    identifier: orgNode.getAttribute('identifier') || crypto.randomUUID(),
    title: textContent(orgNode.querySelector('title')) || fallbackTitle,
    items: Array.from(orgNode.getElementsByTagName('item')).map((itemNode) => ({
      identifier: itemNode.getAttribute('identifier') || crypto.randomUUID(),
      title: textContent(itemNode.querySelector('title')) || 'Untitled SCO',
      resource: itemNode.getAttribute('identifierref') || '',
    })),
  }));

  const defaultOrgId = manifestEl.getAttribute('default') || organizations[0]?.identifier;
  const defaultOrg = organizations.find((org) => org.identifier === defaultOrgId) || organizations[0];

  const firstResourceId = defaultOrg?.items.find((item) => item.resource)?.resource || '';
  const defaultResource = resources.find((resource) => resource.identifier === firstResourceId);
  const firstHref = defaultResource?.href || resources.find((resource) => resource.href)?.href || 'index.html';

  const metadataText = manifestXml.toLowerCase();
  const schemaVersionText = textContent(doc.querySelector('metadata > schemaversion'));
  let version = '1.2';
  if (schemaVersionText.includes('2004') || metadataText.includes('scorm 2004')) {
    version = '2004';
  }

  return {
    version,
    organizations,
    resources,
    entryPoint: firstHref,
    title: defaultOrg?.title || fallbackTitle,
  };
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Authorization required' }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid authorization token' }, 401);
    }

    const { data: requesterProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdminRequester =
      requesterProfile?.role === 'admin' ||
      user.id === SPECIAL_ADMIN_ID ||
      user.email === SPECIAL_ADMIN_EMAIL;

    if (!isAdminRequester) {
      return jsonResponse({ error: 'Only admins can upload SCORM packages' }, 403);
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return jsonResponse({ error: 'No file provided' }, 400);
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      return jsonResponse({ error: 'SCORM package must be a .zip file' }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const manifestFile = zip.file(/(^|\/)imsmanifest\.xml$/i)?.[0];
    if (!manifestFile) {
      return jsonResponse({ error: 'imsmanifest.xml is required at package root or subfolders' }, 400);
    }

    const manifestXml = await manifestFile.async('string');
    const parsedManifest = parseManifest(manifestXml, file.name.replace(/\.zip$/i, ''));

    const allEntries = Object.values(zip.files).filter((entry) => !entry.dir);
    const safeEntries = allEntries
      .map((entry) => ({ entry, safePath: sanitizeZipPath(entry.name) }))
      .filter((item) => Boolean(item.safePath)) as Array<{ entry: any; safePath: string }>;

    if (safeEntries.length === 0) {
      return jsonResponse({ error: 'No valid files found in ZIP archive' }, 400);
    }

    const packageId = crypto.randomUUID();
    const storagePrefix = `${packageId}/`;

    for (const { entry, safePath } of safeEntries) {
      const content = await entry.async('uint8array');
      const fullPath = `${storagePrefix}${safePath}`;
      const { error: uploadError } = await supabase.storage
        .from('scorm-packages')
        .upload(fullPath, content, {
          contentType: inferContentType(safePath),
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error for', fullPath, uploadError);
        return jsonResponse({ error: `Failed to upload package file: ${safePath}` }, 500);
      }
    }

    const safeEntryPoint = sanitizeZipPath(parsedManifest.entryPoint);
    if (!safeEntryPoint) {
      return jsonResponse({ error: 'Could not resolve a valid package entry point from manifest' }, 400);
    }

    const availablePaths = new Set(safeEntries.map((entry) => entry.safePath));
    if (!availablePaths.has(safeEntryPoint)) {
      return jsonResponse(
        { error: `Manifest entry point "${safeEntryPoint}" was not found in the uploaded archive` },
        400
      );
    }

    const { data: packageData, error: packageError } = await supabase
      .from('scorm_packages')
      .insert({
        id: packageId,
        title: parsedManifest.title,
        version: parsedManifest.version,
        entry_point: safeEntryPoint,
        manifest_json: {
          version: parsedManifest.version,
          organizations: parsedManifest.organizations,
          resources: parsedManifest.resources,
        },
        storage_prefix: storagePrefix,
        created_by: user.id,
        is_active: true,
      })
      .select('id, title, version, entry_point')
      .single();

    if (packageError || !packageData) {
      console.error('Package creation error:', packageError);
      return jsonResponse({ error: 'Failed to create package record' }, 500);
    }

    const resourceById = new Map(parsedManifest.resources.map((resource) => [resource.identifier, resource]));
    const defaultOrg = parsedManifest.organizations[0];
    const scoData = (defaultOrg?.items || [])
      .map((item) => {
        const resource = resourceById.get(item.resource);
        const launchHref = sanitizeZipPath(resource?.href || parsedManifest.entryPoint);
        if (!launchHref) return null;

        return {
          package_id: packageId,
          identifier: item.identifier,
          title: item.title,
          launch_href: launchHref,
        };
      })
      .filter(Boolean);

    if (scoData.length > 0) {
      const { error: scoError } = await supabase
        .from('scorm_scos')
        .insert(scoData);

      if (scoError) {
        console.error('SCO creation error:', scoError);
      }
    }

    return jsonResponse({
      package_id: packageId,
      title: packageData.title,
      version: packageData.version,
      entry_point: packageData.entry_point,
    });
  } catch (error) {
    console.error('Error in scorm-upload:', error);
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
});
