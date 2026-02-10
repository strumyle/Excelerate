
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface RequireAuthProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export function RequireAuth({ children, allowedRoles = ['admin'] }: RequireAuthProps) {
  const [user, setUser] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        
        // Get current user session
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) {
          console.log("No auth session found");
          toast({
            title: "Authentication error",
            description: "You must be logged in to access this page.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        setUser(sessionData.session.user);
        
        // Special case for our main admin user - hardcoded for reliability
        const specialAdminId = '600a8af2-9ccf-4c55-b351-a14e2b5b2221';
        const specialAdminEmail = 'ameh.oche@babbangona.com';
        
        if (sessionData.session.user.id === specialAdminId || 
            sessionData.session.user.email === specialAdminEmail) {
          console.log("Special admin user detected, granting admin access");
          setUserRole('admin');
          setLoading(false);
          return;
        }
        
        try {
          // Try to fetch user role from the database directly
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role, verified, location, unit')
            .eq('id', sessionData.session.user.id)
            .single();
            
          if (userError) {
            console.error('Error fetching user role:', userError);
            
            // For recursion errors, use email-based fallback logic
            if (userError.message.includes('infinite recursion')) {
              console.log("Using fallback role determination based on email");
              // If email ends with babbangona.com, give candidate role by default
              const email = sessionData.session.user.email;
              if (email && email.endsWith('@babbangona.com')) {
                setUserRole('candidate');
                setLoading(false);
                return;
              }
            }
            
            // Otherwise show error and redirect to login
            toast({
              title: "Error",
              description: "Failed to verify your access privileges. Please login again.",
              variant: "destructive",
            });
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }
          
          if (userData) {
            console.log("User data fetched:", userData);
            // Set role with fallback to 'candidate' if null
            setUserRole(userData.role || 'candidate');
            
            // If role is missing, update it
            if (!userData.role) {
              try {
                const { error: updateError } = await supabase
                  .from('users')
                  .update({ role: 'candidate' })
                  .eq('id', sessionData.session.user.id);
                  
                if (updateError) {
                  console.error('Error updating user role:', updateError);
                }
              } catch (err) {
                console.error('Error setting default role:', err);
              }
            }
            
          } else {
            // If no user data found, use email-based role assignment
            console.log("No user data found, using email-based role determination");
            const email = sessionData.session.user.email;
            
            let defaultRole = 'candidate';
            
            // Use email for role assignment as fallback mechanism
            if (email === 'ameh.oche@babbangona.com') {
              defaultRole = 'admin';
            }
            
            setUserRole(defaultRole);
            
            try {
              // Create a new user record with email-based role
              const { error: insertError } = await supabase
                .from('users')
                .insert({
                  id: sessionData.session.user.id,
                  email: sessionData.session.user.email,
                  role: defaultRole,
                });
                
              if (insertError) {
                console.error('Error creating user record:', insertError);
                // If insert fails, we'll still use the defaultRole from above
              }
            } catch (err) {
              console.error('Error creating default user:', err);
            }
          }
        } catch (error) {
          console.error('User data fetch error:', error);
          // In case of any other error, use email-based fallback
          const email = sessionData.session.user.email;
          if (email === 'ameh.oche@babbangona.com') {
            setUserRole('admin');
          } else if (email && email.endsWith('@babbangona.com')) {
            setUserRole('candidate');
          } else {
            // If we can't determine role, redirect to login
            toast({
              title: "Error",
              description: "Failed to verify your access privileges. Please login again.",
              variant: "destructive",
            });
            await supabase.auth.signOut();
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Auth check error:', error);
        setLoading(false);
      }
    };

    checkAuth();
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-excelerate-600" />
        <span className="ml-2 text-xl font-medium">Loading...</span>
      </div>
    );
  }

  if (!user) {
    // Redirect to login but save the current location they were trying to access
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Special case for our admin user (double-check)
  const specialAdminId = '600a8af2-9ccf-4c55-b351-a14e2b5b2221';
  const specialAdminEmail = 'ameh.oche@babbangona.com';
  
  if (user.id === specialAdminId || user.email === specialAdminEmail) {
    console.log("Special admin access granted");
    return <>{children}</>;
  }

  // Check if user role is allowed to access this route
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    console.log(`User role ${userRole} not in allowed roles:`, allowedRoles);
    
    // If user is a candidate, redirect them to the exam page
    if (userRole === 'candidate') {
      return <Navigate to="/candidate-dashboard" replace />;
    }
    
    // Otherwise redirect to access denied
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}
