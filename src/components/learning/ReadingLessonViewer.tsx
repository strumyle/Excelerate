import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import type { CourseModule } from '@/lib/learning';

interface ReadingLessonViewerProps {
  lesson: CourseModule;
  onComplete: () => void;
  isCompleted: boolean;
}

export function ReadingLessonViewer({ lesson, onComplete, isCompleted }: ReadingLessonViewerProps) {
  if (!lesson.content_url || lesson.type !== 'article') {
    return (
      <div className="bg-muted rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No reading content available for this lesson.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reading Content */}
      <div className="prose prose-gray max-w-none">
        <iframe
          src={lesson.content_url}
          className="w-full min-h-[500px] border-0 rounded-lg"
          title={lesson.title}
        />
      </div>

      {/* Completion Action */}
      {!isCompleted && (
        <div className="flex justify-center">
          <Button onClick={onComplete} className="px-8">
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark as Complete
          </Button>
        </div>
      )}

      {isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-800 font-medium">
            ✅ You have completed this reading lesson.
          </p>
        </div>
      )}
      
      {lesson.duration_minutes && (
        <p className="text-sm text-muted-foreground text-center">
          Estimated reading time: {lesson.duration_minutes} minutes
        </p>
      )}
    </div>
  );
}