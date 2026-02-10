// Legacy component - deprecated in favor of new course structure
import React from 'react';
import { Card } from '@/components/ui/card';

export function ModuleAccordion() {
  return (
    <Card className="p-4">
      <div className="text-center text-muted-foreground">
        <p>This module format is deprecated. Please use the new course structure.</p>
      </div>
    </Card>
  );
}