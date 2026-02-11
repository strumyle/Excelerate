import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { startScormPackage } from '@/lib/scorm';

interface ScormLesson {
  id: string;
  title: string;
  scorm_package_id: string;
  modules: {
    course_id: string;
    title: string;
    courses: {
      id: string;
      title: string;
    };
  };
  scorm_packages: {
    id: string;
    title: string;
    version: string;
  };
  latest_attempt?: {
    id: string;
    status: string;
    score_raw?: number;
    completed_at?: string;
  } | null;
}

export default function ScormLessonsTab() {
  const [lessons, setLessons] = useState<ScormLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingPackage, setStartingPackage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    void loadScormLessons();
  }, []);

  const loadScormLessons = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('list-scorm-lessons', {
        body: { action: 'list' },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setLessons((data?.lessons || []) as ScormLesson[]);
    } catch (error: any) {
      console.error('Error loading SCORM lessons:', error);
      toast({
        title: 'Error',
        description: `Failed to load SCORM lessons: ${error.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePlayScorm = async (packageId: string) => {
    try {
      setStartingPackage(packageId);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: existingAttempts } = await supabase
        .from('scorm_attempts')
        .select('id, status')
        .eq('package_id', packageId)
        .eq('user_id', user?.id)
        .in('status', ['not_attempted', 'incomplete'])
        .order('created_at', { ascending: false })
        .limit(1);

      let attemptId: string | null = null;

      if (existingAttempts && existingAttempts.length > 0) {
        attemptId = existingAttempts[0].id;
      } else {
        const result = await startScormPackage(packageId);
        attemptId = result.attempt_id || null;
      }

      if (!attemptId) {
        throw new Error('Could not start or resume SCORM attempt');
      }

      navigate(`/learn/scorm/${attemptId}`);
    } catch (error) {
      console.error('Error starting SCORM package:', error);
      toast({
        title: 'Error',
        description: 'Failed to start SCORM package',
        variant: 'destructive',
      });
    } finally {
      setStartingPackage(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading SCORM content...</p>
        </div>
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="text-center py-12">
        <Play className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No SCORM Content</h3>
        <p className="text-muted-foreground">No SCORM lessons are available in your enrolled courses.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {lessons.map((lesson) => {
        const isCompleted =
          lesson.latest_attempt?.status === 'completed' || lesson.latest_attempt?.status === 'passed';
        const hasAttempt = Boolean(lesson.latest_attempt);
        const canOpenCourse = Boolean(
          lesson.modules.course_id &&
          lesson.modules.course_id !== 'null' &&
          lesson.modules.course_id !== 'undefined'
        );

        return (
          <Card key={lesson.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{lesson.title}</CardTitle>
                  <CardDescription className="mt-1">
                    {lesson.modules.courses.title} - {lesson.modules.title}
                  </CardDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">SCORM {lesson.scorm_packages.version}</Badge>
                    {isCompleted && <Badge variant="default">Completed</Badge>}
                    {hasAttempt && !isCompleted && <Badge variant="secondary">In Progress</Badge>}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {lesson.latest_attempt && (
                <div className="text-sm text-muted-foreground">
                  {lesson.latest_attempt.score_raw !== null && (
                    <p>Score: {lesson.latest_attempt.score_raw}%</p>
                  )}
                  {lesson.latest_attempt.completed_at && (
                    <p>Completed: {new Date(lesson.latest_attempt.completed_at).toLocaleDateString()}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => void handlePlayScorm(lesson.scorm_package_id)}
                  disabled={startingPackage === lesson.scorm_package_id}
                  className="flex-1"
                  variant={isCompleted ? 'secondary' : 'default'}
                >
                  {startingPackage === lesson.scorm_package_id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {hasAttempt ? 'Continue' : 'Start'}
                </Button>

                {isCompleted && (
                  <Button
                    onClick={() => {
                      if (canOpenCourse) {
                        navigate(`/courses/${lesson.modules.course_id}`);
                        return;
                      }
                      toast({
                        title: 'Course unavailable',
                        description: 'No valid course was linked to this SCORM lesson.',
                        variant: 'destructive',
                      });
                    }}
                    variant="outline"
                    size="icon"
                    title="View Course"
                    disabled={!canOpenCourse}
                  >
                    <BookOpen className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
