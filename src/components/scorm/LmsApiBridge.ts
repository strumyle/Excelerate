import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';

interface ScormAPI {
  [key: string]: (...args: any[]) => any;
}

export function attachScormApis({ attemptId }: { attemptId: string }) {
  let lastErrorCode = '0';

  const post = async (action: string, body?: Record<string, unknown>) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) {
        lastErrorCode = '401';
        return action === 'getValue' ? '' : 'false';
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/scorm-runtime/${attemptId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const result = await response.json().catch(() => ({}));
      lastErrorCode = typeof result?.errorCode === 'string' ? result.errorCode : response.ok ? '0' : '101';

      if (action === 'getValue') {
        return response.ok ? String(result?.value ?? '') : '';
      }

      if (!response.ok || result?.success === false) {
        return 'false';
      }

      if (action === 'terminate' && result.completed) {
        window.parent.postMessage({ type: 'scorm_completed' }, '*');
      }

      return 'true';
    } catch (error) {
      console.error('SCORM API Error:', error);
      lastErrorCode = '101';
      return action === 'getValue' ? '' : 'false';
    }
  };

  // SCORM 1.2 API
  const API: ScormAPI = {
    LMSInitialize: (_param: string) => post('initialize'),
    LMSGetValue: (key: string) => post('getValue', { key }),
    LMSSetValue: (key: string, value: string) => post('setValue', { key, value }),
    LMSCommit: (_param: string) => post('commit'),
    LMSFinish: (_param: string) => post('terminate'),
    LMSGetLastError: () => lastErrorCode,
    LMSGetErrorString: (_errorCode: string) => '',
    LMSGetDiagnostic: (_errorCode: string) => '',
  };

  // SCORM 2004 API
  const API_1484_11: ScormAPI = {
    Initialize: (_param: string) => post('initialize'),
    GetValue: (key: string) => post('getValue', { key }),
    SetValue: (key: string, value: string) => post('setValue', { key, value }),
    Commit: (_param: string) => post('commit'),
    Terminate: (_param: string) => post('terminate'),
    GetLastError: () => lastErrorCode,
    GetErrorString: (_errorCode: string) => '',
    GetDiagnostic: (_errorCode: string) => '',
  };

  (window as any).API = API;
  (window as any).API_1484_11 = API_1484_11;

  console.log('SCORM APIs attached for attempt:', attemptId);
}

export function findScormAPI(): ScormAPI | null {
  let win: Window | null = window;
  let attempts = 0;

  while (win && attempts < 10) {
    if ((win as any).API || (win as any).API_1484_11) {
      return (win as any).API || (win as any).API_1484_11;
    }

    if (win.parent && win.parent !== win) {
      win = win.parent;
    } else if (win.opener) {
      win = win.opener;
    } else {
      break;
    }

    attempts += 1;
  }

  return null;
}
