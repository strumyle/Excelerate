import { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border py-4 bg-card">
        <div className="container flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">M</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">MyExcelerate</h1>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4 bg-secondary/30">
        <Card className="w-full max-w-md p-8 bg-card border-border shadow-lg">
          {children}
        </Card>
      </main>
    </div>
  );
}
