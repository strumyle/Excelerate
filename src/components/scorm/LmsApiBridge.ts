interface ScormAPI {
  [key: string]: (...args: any[]) => any;
}

export function attachScormApis({ attemptId }: { attemptId: string }) {
  // SCORM 1.2 API
  const API: ScormAPI = {
    LMSInitialize: (param: string) => post('initialize'),
    LMSGetValue: (key: string) => post('getValue', { key }),
    LMSSetValue: (key: string, value: string) => post('setValue', { key, value }),
    LMSCommit: (param: string) => post('commit'),
    LMSFinish: (param: string) => post('terminate'),
    LMSGetLastError: () => "0",
    LMSGetErrorString: (errorCode: string) => "",
    LMSGetDiagnostic: (errorCode: string) => ""
  };

  // SCORM 2004 API
  const API_1484_11: ScormAPI = {
    Initialize: (param: string) => post('initialize'),
    GetValue: (key: string) => post('getValue', { key }),
    SetValue: (key: string, value: string) => post('setValue', { key, value }),
    Commit: (param: string) => post('commit'),
    Terminate: (param: string) => post('terminate'),
    GetLastError: () => "0",
    GetErrorString: (errorCode: string) => "",
    GetDiagnostic: (errorCode: string) => ""
  };

  // Expose APIs globally
  (window as any).API = API;
  (window as any).API_1484_11 = API_1484_11;

  async function post(action: string, body?: any) {
    try {
      const response = await fetch(`https://xrfiltyxdviefanplykg.supabase.co/functions/v1/scorm-runtime/${attemptId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token') || ''}`
        },
        body: body ? JSON.stringify(body) : undefined
      });
      
      const result = await response.json();
      
      if (action === 'getValue') {
        return result.value || '';
      }
      
      if (action === 'terminate' && result.completed) {
        // Notify parent window of completion
        window.parent.postMessage({ type: 'scorm_completed' }, '*');
      }
      
      return result.success ? 'true' : 'false';
    } catch (error) {
      console.error('SCORM API Error:', error);
      return 'false';
    }
  }
  
  console.log('SCORM APIs attached for attempt:', attemptId);
}

// Helper to find SCORM API in window hierarchy (for content to use)
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
    attempts++;
  }
  
  return null;
}