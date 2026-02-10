import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  PlayCircle, 
  FileText, 
  HelpCircle, 
  ExternalLink, 
  Clock, 
  CheckCircle2,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { upsertModuleProgress } from '@/lib/learning';
import type { CourseModule, ModuleProgress } from '@/lib/learning';
import { useToast } from '@/hooks/use-toast';
import { VideoPlayer } from '@/components/VideoPlayer';

interface ModuleViewerProps {
  module: CourseModule;
  progress: ModuleProgress | null;
  onProgressUpdate?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export default function ModuleViewer({
  module,
  progress,
  onProgressUpdate,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious
}: ModuleViewerProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isCompleted = progress?.status === 'completed';
  const isInProgress = progress?.status === 'in_progress';

  useEffect(() => {
    // Mark as in progress when opening
    if (!progress || progress.status === 'not_started') {
      handleProgressUpdate('in_progress');
    }
  }, [module.id]);

  const handleProgressUpdate = async (status: 'not_started' | 'in_progress' | 'completed', score?: number) => {
    try {
      setLoading(true);
      await upsertModuleProgress(module.id, status, score);
      onProgressUpdate?.();
    } catch (error) {
      console.error('Progress update error:', error);
      toast({
        title: "Error",
        description: "Failed to update progress",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    handleProgressUpdate('completed');
    toast({
      title: "Module Completed!",
      description: `You've completed "${module.title}"`
    });
  };

  const getModuleIcon = () => {
    switch (module.type) {
      case 'video':
        return <PlayCircle className="h-5 w-5" />;
      case 'article':
        return <FileText className="h-5 w-5" />;
      case 'quiz':
        return <HelpCircle className="h-5 w-5" />;
      case 'embed':
        return <ExternalLink className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getModuleTypeLabel = () => {
    switch (module.type) {
      case 'video':
        return 'Video Lesson';
      case 'article':
        return 'Reading Material';
      case 'quiz':
        return 'Quiz';
      case 'embed':
        return 'External Content';
      default:
        return 'Module';
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {getModuleIcon()}
                <Badge variant="secondary">{getModuleTypeLabel()}</Badge>
                {module.is_required && (
                  <Badge variant="outline">Required</Badge>
                )}
                {isCompleted && (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
              <CardTitle className="text-2xl">{module.title}</CardTitle>
              {module.duration_minutes && (
                <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{module.duration_minutes} minutes</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Module Content */}
      <Card>
        <CardContent className="p-6">
          {module.content_url && (
            <div className="space-y-4">
              {module.type === 'video' && (
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  {(() => {
                    const url = module.content_url;
                    if (url.includes('youtube.com') || url.includes('youtu.be')) {
                      return (
                        <VideoPlayer
                          videoType="youtube"
                          videoUrl={url}
                          title={module.title}
                          className="w-full h-full"
                        />
                      );
                    } else if (url.includes('.webm')) {
                      return (
                        <VideoPlayer
                          videoType="webm"
                          videoUrl={url}
                          title={module.title}
                          className="w-full h-full"
                        />
                      );
                    } else if (url.includes('.ogg')) {
                      return (
                        <VideoPlayer
                          videoType="ogg"
                          videoUrl={url}
                          title={module.title}
                          className="w-full h-full"
                        />
                      );
                    } else {
                      return (
                        <VideoPlayer
                          videoType="mp4"
                          videoUrl={url}
                          title={module.title}
                          className="w-full h-full"
                        />
                      );
                    }
                  })()}
                </div>
              )}

              {module.type === 'article' && (
                <div className="prose prose-slate max-w-none">
                  <iframe
                    src={module.content_url}
                    className="w-full min-h-[500px] border-0"
                    title={module.title}
                  />
                </div>
              )}

              {module.type === 'embed' && (
                <div className="rounded-lg border">
                  {module.content_url.includes('youtube.com') || module.content_url.includes('youtu.be') ? (
                    <div className="aspect-video">
                      <VideoPlayer
                        videoType="youtube"
                        videoUrl={module.content_url}
                        title={module.title}
                        className="w-full h-full"
                      />
                    </div>
                  ) : (
                    <iframe
                      src={module.content_url}
                      className="w-full min-h-[600px] border-0 rounded-lg"
                      title={module.title}
                    />
                  )}
                </div>
              )}

              {module.type === 'quiz' && (
                <div className="text-center py-8">
                  <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Interactive Quiz</h3>
                  <p className="text-muted-foreground mb-4">
                    Complete this quiz to test your understanding of the material.
                  </p>
                  <Button 
                    onClick={() => window.open(module.content_url, '_blank')}
                    size="lg"
                  >
                    Start Quiz
                  </Button>
                </div>
              )}
            </div>
          )}

          {!module.content_url && (
            <div className="text-center py-8">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Content Coming Soon</h3>
              <p className="text-muted-foreground">
                This module's content is currently being prepared.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Module Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={onPrevious}
              disabled={!hasPrevious}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex items-center gap-3">
              {!isCompleted && (
                <Button
                  onClick={handleComplete}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Complete
                    </>
                  )}
                </Button>
              )}

              <Button
                onClick={onNext}
                disabled={!hasNext || (!isCompleted && module.is_required)}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          {!isCompleted && module.is_required && (
            <p className="text-sm text-muted-foreground mt-3 text-center">
              Complete this required module to proceed to the next one.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}