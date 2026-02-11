import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { attachScormApis } from '@/components/scorm/LmsApiBridge';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RotateCcw } from 'lucide-react';

const encodeFilePath = (path: string) =>
  path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

export default function ScormPlayer() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [attemptData, setAttemptData] = useState<any>(null);
  const [iframeSrc, setIframeSrc] = useState('');

  useEffect(() => {
    if (!attemptId) return;

    attachScormApis({ attemptId });
    void loadAttemptData(attemptId);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'scorm_completed') {
        toast.success('Course completed! You can now get your certificate.');
        void loadAttemptData(attemptId);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [attemptId]);

  const loadAttemptData = async (activeAttemptId: string) => {
    try {
      setLoading(true);

      const [attemptResponse, sessionResponse] = await Promise.all([
        supabase
          .from('scorm_attempts')
          .select(`
            *,
            scorm_packages(*)
          `)
          .eq('id', activeAttemptId)
          .single(),
        supabase.auth.getSession(),
      ]);

      if (attemptResponse.error || !attemptResponse.data) {
        throw attemptResponse.error || new Error('Attempt not found');
      }

      const token = sessionResponse.data.session?.access_token;
      if (!token) {
        throw new Error('No active authentication token found.');
      }

      const entryPoint = attemptResponse.data.scorm_packages?.entry_point || 'index.html';
      const encodedEntryPoint = encodeFilePath(entryPoint);
      const encodedToken = encodeURIComponent(token);
      const src = `${SUPABASE_URL}/functions/v1/scorm-file/${activeAttemptId}/token/${encodedToken}/${encodedEntryPoint}`;

      setAttemptData(attemptResponse.data);
      setIframeSrc(src);
    } catch (error) {
      console.error('Error loading attempt:', error);
      toast.error('Failed to load SCORM content');
      navigate('/learning-path');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!attemptData) return;

    try {
      const { data, error } = await supabase.functions.invoke('scorm-start', {
        body: { packageId: attemptData.package_id },
      });

      if (error) throw error;

      if (data?.attempt_id) {
        navigate(`/learn/scorm/${data.attempt_id}`);
      }
    } catch (error) {
      console.error('Error restarting:', error);
      toast.error('Failed to restart course');
    }
  };

  const handleGetCertificate = async () => {
    if (!attemptData) return;

    try {
      const { data, error } = await supabase.functions.invoke('issue-certificate', {
        body: {
          courseId: attemptData.package_id,
          score: attemptData.score_raw || 100,
        },
      });

      if (error) throw error;

      if (data?.pdf_url) {
        window.open(data.pdf_url, '_blank');
        toast.success('Certificate downloaded successfully');
      }
    } catch (error) {
      console.error('Error getting certificate:', error);
      toast.error('Failed to generate certificate');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-card border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/learning-path')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Learning Path
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{attemptData?.scorm_packages?.title}</h1>
            <p className="text-sm text-muted-foreground">
              Attempt {attemptData?.attempt_no} - Status: {attemptData?.status}
              {typeof attemptData?.score_raw === 'number' ? ` - Score: ${attemptData.score_raw}%` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {attemptData?.status === 'completed' && (
            <Button onClick={handleGetCertificate} size="sm">
              Get Certificate
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestart}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Restart
          </Button>
        </div>
      </div>

      {attemptData?.status === 'in_progress' && (
        <div className="bg-blue-50 border-b border-blue-200 p-3">
          <p className="text-sm text-blue-800 text-center">Resuming where you left off...</p>
        </div>
      )}

      <div className="flex-1 bg-black">
        <iframe
          src={iframeSrc}
          className="w-full h-full border-0"
          title={`SCORM Content - ${attemptData?.scorm_packages?.title}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
          loading="lazy"
        />
      </div>
    </div>
  );
}
