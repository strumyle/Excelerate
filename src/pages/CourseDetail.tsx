import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { 
  BookOpen, 
  ArrowLeft, 
  CheckCircle2, 
  Clock,
  FileText,
  HelpCircle,
  ExternalLink,
  PlayCircle
} from 'lucide-react';
import { getCourse, getCourseModules, getCourseProgress } from '@/lib/learning';
import type { Course, Chapter, CourseModule, EnrollmentProgress } from '@/lib/learning';
import ModuleViewer from '@/components/learning/ModuleViewer';
import { useToast } from '@/hooks/use-toast';

interface ModuleWithProgress extends CourseModule {
  progress: any[];
  chapter_title: string;
  chapter_position: number;
}

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [chapters, setChapters] = useState<(Chapter & { course_modules: CourseModule[] })[]>([]);
  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [progress, setProgress] = useState<EnrollmentProgress | null>(null);
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (courseId) {
      loadCourseData();
    }
  }, [courseId]);

  const loadCourseData = async () => {
    if (!courseId || courseId === 'undefined' || courseId === 'null') {
      setCourse(null);
      setChapters([]);
      setModules([]);
      setProgress(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const courseData = await getCourse(courseId);
      const resolvedCourseId = courseData.course.id;
      const [progressData, modulesData] = await Promise.all([
        getCourseProgress(resolvedCourseId),
        getCourseModules(resolvedCourseId)
      ]);

      setCourse(courseData.course);
      setChapters(courseData.chapters);
      setProgress(progressData);

      // Transform modules with chapter info
      const modulesWithChapter = modulesData.map((module: any) => ({
        ...module,
        chapter_title: courseData.chapters.find((ch: any) => ch.id === module.chapter_id)?.title || '',
        chapter_position: courseData.chapters.find((ch: any) => ch.id === module.chapter_id)?.position || 0
      }));

      // Sort modules by chapter position then module position
      modulesWithChapter.sort((a, b) => {
        if (a.chapter_position !== b.chapter_position) {
          return a.chapter_position - b.chapter_position;
        }
        return a.position - b.position;
      });

      setModules(modulesWithChapter);

      // Set current module to next incomplete required module or first module
      const nextModule = modulesWithChapter.find((module) => {
        if (!module.is_required) return false;
        const moduleProgress = module.progress?.[0];
        return moduleProgress?.status !== 'completed';
      });
      if (nextModule) {
        setCurrentModuleId(nextModule.id);
      } else if (modulesWithChapter.length > 0) {
        setCurrentModuleId(modulesWithChapter[0].id);
      }

    } catch (error: any) {
      console.error('Error loading course:', {
        courseId,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      toast({
        title: "Error",
        description: error?.message || "Failed to load course data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentModule = () => {
    return modules.find(m => m.id === currentModuleId) || null;
  };

  const getCurrentModuleIndex = () => {
    return modules.findIndex(m => m.id === currentModuleId);
  };

  const goToNextModule = () => {
    const currentIndex = getCurrentModuleIndex();
    if (currentIndex < modules.length - 1) {
      setCurrentModuleId(modules[currentIndex + 1].id);
    }
  };

  const goToPreviousModule = () => {
    const currentIndex = getCurrentModuleIndex();
    if (currentIndex > 0) {
      setCurrentModuleId(modules[currentIndex - 1].id);
    }
  };

  const getModuleIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <PlayCircle className="h-4 w-4" />;
      case 'article':
        return <FileText className="h-4 w-4" />;
      case 'quiz':
        return <HelpCircle className="h-4 w-4" />;
      case 'embed':
        return <ExternalLink className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getModuleProgress = (module: ModuleWithProgress) => {
    const moduleProgress = module.progress?.[0];
    if (!moduleProgress) return { status: 'not_started', progress: 0 };
    
    switch (moduleProgress.status) {
      case 'completed':
        return { status: 'completed', progress: 100 };
      case 'in_progress':
        return { status: 'in_progress', progress: 50 };
      default:
        return { status: 'not_started', progress: 0 };
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading course...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="text-center py-12">
            <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Course not found</h3>
            <p className="text-muted-foreground mb-4">
              The course you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button onClick={() => navigate('/learning-path')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Learning Path
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentModule = getCurrentModule();
  const currentIndex = getCurrentModuleIndex();

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/learning-path')}>
              Learning Path
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{course.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Course Structure */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Course Content
              </CardTitle>
              {progress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{Math.round(progress.percent_complete)}%</span>
                  </div>
                  <Progress value={progress.percent_complete} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {progress.completed_required} of {progress.required_modules} required completed
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {chapters.map((chapter) => (
                <div key={chapter.id} className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground">
                    {chapter.title}
                  </h4>
                  <div className="space-y-1">
                    {chapter.course_modules.map((module) => {
                      const moduleWithProgress = modules.find(m => m.id === module.id);
                      const moduleProgress = moduleWithProgress ? getModuleProgress(moduleWithProgress) : { status: 'not_started', progress: 0 };
                      const isActive = currentModuleId === module.id;
                      
                      return (
                        <Button
                          key={module.id}
                          variant={isActive ? "secondary" : "ghost"}
                          className="w-full justify-start text-left h-auto p-2"
                          onClick={() => setCurrentModuleId(module.id)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            {getModuleIcon(module.type)}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs truncate">{module.title}</p>
                              {module.duration_minutes && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {module.duration_minutes}m
                                </p>
                              )}
                            </div>
                            {moduleProgress.status === 'completed' && (
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                            )}
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {currentModule ? (
            <ModuleViewer
              module={currentModule}
              progress={currentModule.progress?.[0] || null}
              onProgressUpdate={loadCourseData}
              onNext={goToNextModule}
              onPrevious={goToPreviousModule}
              hasNext={currentIndex < modules.length - 1}
              hasPrevious={currentIndex > 0}
            />
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No content available</h3>
                <p className="text-muted-foreground">
                  This course doesn't have any modules yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
