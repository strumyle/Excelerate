import { supabase } from '@/integrations/supabase/client';

export interface ScormPackage {
  id: string;
  title: string;
  version: string;
  entry_point: string;
  manifest_json: any;
  storage_prefix: string;
  created_at: string;
  is_active: boolean;
}

export interface ScormAttempt {
  id: string;
  package_id: string;
  user_id: string;
  attempt_no: number;
  status: string;
  score_raw?: number;
  score_min?: number;
  score_max?: number;
  total_time?: string;
  started_at?: string;
  completed_at?: string;
  scorm_packages?: ScormPackage;
}

export async function getMyScormPackages() {
  const { data, error } = await supabase
    .from('scorm_packages')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching SCORM packages:', error);
    throw error;
  }

  return data || [];
}

export async function getMyScormAttempts() {
  const { data, error } = await supabase
    .from('scorm_attempts')
    .select(`
      *,
      scorm_packages(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching SCORM attempts:', error);
    throw error;
  }

  return data || [];
}

export async function startScormPackage(packageId: string) {
  const { data, error } = await supabase.functions.invoke('scorm-start', {
    body: { packageId }
  });

  if (error) {
    console.error('Error starting SCORM package:', error);
    throw error;
  }

  if (!data?.attempt_id) {
    throw new Error('SCORM start response is missing attempt_id.');
  }

  return data;
}

export async function getScormProgress(userId: string) {
  const { data, error } = await supabase
    .from('scorm_attempts')
    .select(`
      *,
      scorm_packages(title)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching SCORM progress:', error);
    throw error;
  }

  // Group by package and get latest attempt
  const packageProgress = new Map();
  
  data?.forEach(attempt => {
    const packageId = attempt.package_id;
    if (!packageProgress.has(packageId) || 
        new Date(attempt.created_at) > new Date(packageProgress.get(packageId).created_at)) {
      packageProgress.set(packageId, attempt);
    }
  });

  return Array.from(packageProgress.values());
}

export async function isScormCompleted(packageId: string, userId: string) {
  const { data, error } = await supabase
    .from('scorm_attempts')
    .select('status')
    .eq('package_id', packageId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .limit(1);

  if (error) {
    console.error('Error checking SCORM completion:', error);
    return false;
  }

  return data && data.length > 0;
}
