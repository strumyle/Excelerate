
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { PlayCircle, Loader2, BookOpen } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { VideoPlayer } from '@/components/VideoPlayer';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  youtube_url: string;
  video_type: 'youtube' | 'mp4' | 'webm' | 'ogg';
  video_url: string;
  created_at: string;
  practice_test_id?: string;
}

export function TutorialsSection() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [tutorialQuestionCounts, setTutorialQuestionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTutorials();
  }, []);

  const fetchTutorials = async () => {
    try {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTutorials((data as Tutorial[]) || []);

      // Fetch question counts for each tutorial
      if (data && data.length > 0) {
        const questionCounts: Record<string, number> = {};
        
        for (const tutorial of data) {
          const { count, error: countError } = await supabase
            .from('tutorial_quiz_questions')
            .select('*', { count: 'exact', head: true })
            .eq('tutorial_id', tutorial.id);

          if (!countError) {
            questionCounts[tutorial.id] = count || 0;
          }
        }
        
        setTutorialQuestionCounts(questionCounts);
      }
    } catch (error) {
      console.error('Error fetching tutorials:', error);
      toast({
        title: "Error",
        description: "Failed to load tutorials.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const extractYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };

  const handleTakeQuiz = (tutorialId: string) => {
    navigate(`/tutorial-quiz/${tutorialId}`);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PlayCircle className="h-5 w-5 mr-2" />
            Tutorials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-excelerate-600" />
            <span className="ml-2">Loading tutorials...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <PlayCircle className="h-5 w-5 mr-2" />
          Tutorials
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tutorials.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No tutorials available at the moment.</p>
        ) : (
          <div className="space-y-6">
            {tutorials.map((tutorial) => {
              // Video preview handled by VideoPlayer; no need to parse YouTube ID here
              const questionCount = tutorialQuestionCounts[tutorial.id] || 0;
              
              return (
                <div key={tutorial.id} className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-2">{tutorial.title}</h3>
                  <p className="text-muted-foreground mb-3">{tutorial.description}</p>
                  <div className="text-sm text-muted-foreground mb-4">
                    Published: {format(new Date(tutorial.created_at), 'MMM d, yyyy')}
                  </div>
                  {(tutorial.video_url || tutorial.youtube_url) && (
                    <div className="w-full mb-4">
                      <VideoPlayer
                        videoType={tutorial.video_type || 'youtube'}
                        videoUrl={tutorial.video_url || tutorial.youtube_url}
                        title={tutorial.title}
                        className="w-full"
                      />
                    </div>
                  )}
                  {questionCount > 0 ? (
                    <Button
                      onClick={() => handleTakeQuiz(tutorial.id)}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Take Practice Quiz ({questionCount} questions)
                    </Button>
                  ) : (
                    <div className="w-full p-3 bg-gray-100 text-gray-600 text-center rounded">
                      <BookOpen className="w-4 h-4 mx-auto mb-1" />
                      Practice quiz not available yet
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
