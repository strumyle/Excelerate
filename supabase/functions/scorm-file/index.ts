import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPECIAL_ADMIN_ID = '600a8af2-9ccf-4c55-b351-a14e2b5b2221';
const SPECIAL_ADMIN_EMAIL = 'ameh.oche@babbangona.com';

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const getRouteParams = (url: URL) => {
  const segments = url.pathname.split('/').filter(Boolean);
  const fnIndex = segments.lastIndexOf('scorm-file');
  if (fnIndex < 0) {
    return { attemptIdFromPath: null, fileFromPath: '', tokenFromPath: null };
  }

  const attemptIdFromPath = segments[fnIndex + 1] || null;
  const tokenMarker = segments[fnIndex + 2];
  const hasTokenSegment = tokenMarker === 'token';
  const tokenFromPath = hasTokenSegment ? segments[fnIndex + 3] || null : null;
  const fileFromPath = hasTokenSegment
    ? segments.slice(fnIndex + 4).join('/')
    : segments.slice(fnIndex + 2).join('/');

  return { attemptIdFromPath, fileFromPath, tokenFromPath };
};

const sanitizeRelativePath = (rawPath: string) => {
  if (!rawPath) return '';

  const decoded = decodeURIComponent(rawPath)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();

  if (!decoded) return '';
  if (decoded.includes('..') || decoded.includes('\0')) {
    return null;
  }

  return decoded;
};

const inferContentType = (path: string, fallback: string | null) => {
  if (fallback && fallback.trim().length > 0) return fallback;
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const { attemptIdFromPath, fileFromPath, tokenFromPath } = getRouteParams(url);
    const attemptIdFromQuery = url.searchParams.get('attemptId');
    const fileFromQuery = url.searchParams.get('file') || '';

    const attemptId = attemptIdFromPath || attemptIdFromQuery;
    if (!attemptId) {
      return jsonResponse({ error: 'Attempt ID required' }, 400);
    }

    const tokenFromHeader = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    const tokenFromQuery = url.searchParams.get('token')?.trim();
    const token = tokenFromHeader || tokenFromQuery || (tokenFromPath ? decodeURIComponent(tokenFromPath) : null);

    if (!token) {
      return jsonResponse({ error: 'Authorization required' }, 401);
    }

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

    const { data: attemptData, error: attemptError } = await supabase
      .from('scorm_attempts')
      .select(`
        id,
        user_id,
        scorm_packages(storage_prefix, entry_point)
      `)
      .eq('id', attemptId)
      .single();

    if (attemptError || !attemptData) {
      return jsonResponse({ error: 'Attempt not found' }, 404);
    }

    if (!isAdminRequester && attemptData.user_id !== user.id) {
      return jsonResponse({ error: 'Not allowed to access this attempt' }, 403);
    }

    const storagePrefix = attemptData.scorm_packages?.storage_prefix;
    const entryPoint = attemptData.scorm_packages?.entry_point;

    if (!storagePrefix || !entryPoint) {
      return jsonResponse({ error: 'Package metadata is incomplete' }, 500);
    }

    const rawRequestedPath = fileFromPath || fileFromQuery || entryPoint;
    const safePath = sanitizeRelativePath(rawRequestedPath);

    if (safePath === null) {
      return jsonResponse({ error: 'Invalid file path' }, 400);
    }

    const normalizedPath = safePath || sanitizeRelativePath(entryPoint);
    if (!normalizedPath) {
      return jsonResponse({ error: 'Unable to resolve package entry point' }, 500);
    }

    const fullPath = `${storagePrefix}${normalizedPath}`;

    const { data: fileBlob, error: fileError } = await supabase.storage
      .from('scorm-packages')
      .download(fullPath);

    if (fileError || !fileBlob) {
      console.error('SCORM file download error:', fileError, 'path:', fullPath);
      return jsonResponse({ error: 'Requested SCORM asset not found' }, 404);
    }

    const contentType = inferContentType(normalizedPath, fileBlob.type || null);
    return new Response(fileBlob, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('Error in scorm-file:', error);
    return jsonResponse({ error: error.message || 'Internal server error' }, 500);
  }
});
