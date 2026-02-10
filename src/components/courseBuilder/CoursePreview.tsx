import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Users, BookOpen, Video, FileText, HelpCircle, ExternalLink } from 'lucide-react';
import { CourseWithStructure } from '@/lib/courseBuilder';

interface CoursePreviewProps {
  course: CourseWithStructure;
  onClose: () => void;
}

const moduleTypeIcons = {
  video: Video,
  article: FileText,
  quiz: HelpCircle,
  embed: ExternalLink,
};

const moduleTypeLabels = {
  video: 'Video',
  article: 'Article',
  quiz: 'Quiz',
  embed: 'Embed',
};

export function CoursePreview({ course, onClose }: CoursePreviewProps) {
  const totalModules = course.chapters.reduce((acc, chapter) => acc + chapter.modules.length, 0);
  const totalDuration = course.chapters.reduce(
    (acc, chapter) => acc + chapter.modules.reduce(
      (modAcc, module) => modAcc + (module.duration_minutes || 0), 0
    ), 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Course Preview</h1>
          <p className="text-muted-foreground">Preview how students will see this course</p>
        </div>
      </div>

      {/* Course Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-6">
            {course.thumbnail_url && (
              <img 
                src={course.thumbnail_url} 
                alt={course.title}
                className="w-32 h-20 object-cover rounded-lg border"
              />
            )}
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{course.title}</CardTitle>
                  {course.description && (
                    <p className="text-muted-foreground mt-2">{course.description}</p>
                  )}
                </div>
                <Badge variant={course.is_published ? "default" : "secondary"}>
                  {course.is_published ? "Published" : "Draft"}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {course.category && (
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{course.category}</span>
                  </div>
                )}
                {course.level && (
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{course.level}</span>
                  </div>
                )}
                {totalDuration > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{Math.round(totalDuration / 60 * 10) / 10} hours</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Course Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{course.chapters.length}</div>
              <p className="text-sm text-muted-foreground">Chapters</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{totalModules}</div>
              <p className="text-sm text-muted-foreground">Modules</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{Math.round(totalDuration)} min</div>
              <p className="text-sm text-muted-foreground">Total Duration</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course Structure */}
      <Card>
        <CardHeader>
          <CardTitle>Course Structure</CardTitle>
        </CardHeader>
        <CardContent>
          {course.chapters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="mx-auto h-12 w-12 mb-4" />
              <p>No chapters available yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {course.chapters.map((chapter, chapterIndex) => (
                <div key={chapter.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">
                      Chapter {chapterIndex + 1}: {chapter.title}
                    </h3>
                    <Badge variant="outline">
                      {chapter.modules.length} modules
                    </Badge>
                  </div>
                  
                  {chapter.modules.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      No modules in this chapter yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {chapter.modules.map((module, moduleIndex) => {
                        const Icon = moduleTypeIcons[module.type];
                        return (
                          <div 
                            key={module.id} 
                            className="flex items-center gap-3 p-2 rounded bg-muted/30"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  {moduleIndex + 1}. {module.title}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {moduleTypeLabels[module.type]}
                                </Badge>
                                {module.is_required && (
                                  <Badge variant="secondary" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                              </div>
                              {module.duration_minutes > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Duration: {module.duration_minutes} minutes
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}