
import { useState } from 'react';
import { signIn, signUp } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff } from 'lucide-react';

type AuthMode = 'login' | 'register';

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [unit, setUnit] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate email format (allow any domain)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Special admin case - make sure it always works
      const isAdminEmail = email === 'ameh.oche@babbangona.com';

      let result;
      if (mode === 'login') {
        result = await signIn(email, password);
        if (result) {
          // Special case for admin login
          if (isAdminEmail) {
            toast({
              title: "Admin Login Successful",
              description: "Welcome to the admin dashboard!",
            });
            navigate('/dashboard');
            return;
          }
          
          // For regular users, try to check role from the session
          try {
            // Check if user is an admin or candidate to redirect to the appropriate page
            const { data } = await supabase
              .from('users')
              .select('role')
              .eq('id', result.user.id)
              .single();
            
            if (data && data.role === 'admin') {
              navigate('/dashboard');
              toast({
                title: "Admin Login Successful",
                description: "Welcome to the admin dashboard!",
              });
            } else {
              navigate('/candidate-dashboard');
              toast({
                title: "Logged in",
                description: "Welcome to your exam portal.",
              });
            }
          } catch (error) {
            console.error('Error checking role:', error);
            
            // Fallback to email-based logic if database query fails
            if (isAdminEmail) {
              navigate('/dashboard');
            } else {
              navigate('/candidate-dashboard');
            }
            
            toast({
              title: "Login successful",
              description: "You have been logged in.",
            });
          }
        }
      } else {
        // Store candidate information in the candidates table first
        try {
          const { error: candidateError } = await supabase
            .from('candidates')
            .insert({
              name: fullName,
              unit: unit,
              email: email,
              status: 'pending'
            });

          if (candidateError) throw candidateError;
        } catch (error) {
          console.error('Error saving candidate information:', error);
          toast({
            title: "Registration error",
            description: "Failed to save candidate information. Please try again.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // For registration, we'll create the user with additional metadata
        result = await signUp(email, password, {
          full_name: fullName,
          unit: unit,
          emailRedirectTo: `${window.location.origin}/auth`
        });

        if (result) {
          setVerificationSent(true);
          toast({
            title: "Registration successful",
            description: "Please check your email to verify your account.",
          });
          
          // Create or update the user record in the users table
          try {
            if (result.user) {
              // Set admin role directly for the special admin email
              const role = isAdminEmail ? 'admin' : 'candidate';
              
              await supabase.from('users').upsert({
                id: result.user.id,
                email: email,
                role: role,
                full_name: fullName,
                unit: unit,
                verified: false,
              });
              
              // If admin, also add to admin_permissions
              if (isAdminEmail) {
                try {
                  await supabase.from('admin_permissions').upsert({
                    user_id: result.user.id,
                    can_grant_admin: true,
                  });
                } catch (err) {
                  console.error('Error setting admin permissions:', err);
                }
              }
            }
          } catch (err) {
            console.error('Error creating user record:', err);
          }
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast({
        title: "Authentication error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setEmail('');
    setPassword('');
    setFullName('');
    setUnit('');
    setVerificationSent(false);
  };

  if (verificationSent) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Verification Email Sent
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-6">
            Please check your email ({email}) and click the verification link to complete your registration.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            After verification, you can log in to access your assigned test.
          </p>
          <Button 
            variant="outline" 
            className="mt-2" 
            onClick={toggleMode}
          >
            Return to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          {mode === 'login' ? 'Sign In to Excelerate' : 'Create Account'}
        </CardTitle>
        <CardDescription className="text-center">
          {mode === 'login' 
            ? 'Enter your credentials to access your account' 
            : 'Create your account with any email address'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <>
              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium">
                  Full Name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="unit" className="text-sm font-medium">
                  Unit/Department
                </label>
                <Input
                  id="unit"
                  type="text"
                  placeholder="e.g., Finance, HR, Marketing"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={isLoading || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (mode === 'register' && (!fullName || !unit))}
          >
            {isLoading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Register'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button variant="link" onClick={toggleMode}>
          {mode === 'login'
            ? "Don't have an account? Register"
            : 'Already have an account? Sign In'}
        </Button>
      </CardFooter>
    </Card>
  );
}
