// Legacy component - deprecated in favor of ModuleViewer
import React from 'react';
import { Card } from '@/components/ui/card';

export function LessonItem() {
  return (
    <Card className="p-4">
      <div className="text-center text-muted-foreground">
        <p>This lesson format is deprecated. Please use the new course structure.</p>
      </div>
    </Card>
  );
}