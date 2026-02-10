
import { ReactNode, useEffect, useState } from 'react';
import { CollapsibleSidebar } from './CollapsibleSidebar';
import { getCurrentUser } from '@/lib/supabase';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to access the admin dashboard.",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }
      
      if (!user.email?.endsWith('@babbangona.com')) {
        toast({
          title: "Access denied",
          description: "Only @babbangona.com email addresses are allowed.",
          variant: "destructive",
        });
        navigate('/access-denied');
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-excelerate-600" />
        <p className="mt-4 text-lg">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex">
      <CollapsibleSidebar />
      <main className="flex-1 overflow-auto bg-background">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
