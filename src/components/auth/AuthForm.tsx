import { useEffect, useState } from 'react';
import { signIn, signUp } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

const ONBOARDING_UNITS = [
  'Operator Success.',
  'Enterprise Systems Engineering.',
  'Enterprise Systems Product.',
  'Internal Audit.',
  'Last Mile Logistics.',
  'Inventory Control.',
  'Data.',
  'Performance Acceleration.',
  'Legal & Compliance.',
  'Finance Operations.',
  'Sales.',
  'Security Services.',
  'People & Culture.',
  'Investor Relations.',
  'Internal Services.',
  'Member Success.',
];

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [unit, setUnit] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Email confirmation is disabled — no verification screen needed
  // const [verificationSent, setVerificationSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const recoveryType = hashParams.get('type') || queryParams.get('type');

    if (recoveryType === 'recovery') {
      setMode('reset');
      const recoveryEmail = hashParams.get('email') || queryParams.get('email');
      if (recoveryEmail) {
        setEmail(recoveryEmail);
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const requiresEmail = mode === 'login' || mode === 'register' || mode === 'forgot';
      if (requiresEmail && !emailRegex.test(email)) {
        toast({
          title: 'Invalid Email',
          description: 'Please enter a valid email address.',
          variant: 'destructive',
        });
        return;
      }

      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;

        toast({
          title: 'Reset email sent',
          description: 'Check your inbox for the password reset link.',
        });
        setMode('login');
        return;
      }

      if (mode === 'reset') {
        if (password.length < 6) {
          toast({
            title: 'Password too short',
            description: 'Use at least 6 characters.',
            variant: 'destructive',
          });
          return;
        }

        if (password !== confirmPassword) {
          toast({
            title: 'Passwords do not match',
            description: 'Confirm password must match the new password.',
            variant: 'destructive',
          });
          return;
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;

        toast({
          title: 'Password updated',
          description: 'Your password has been reset. Please sign in.',
        });

        await supabase.auth.signOut();
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        window.history.replaceState({}, document.title, '/auth');
        navigate('/auth', { replace: true });
        return;
      }

      // Special admin case - make sure it always works
      const isAdminEmail = email === 'ameh.oche@babbangona.com';

      let result;
      if (mode === 'login') {
        result = await signIn(email, password);
        if (!result) return;

        if (isAdminEmail) {
          toast({
            title: 'Admin Login Successful',
            description: 'Welcome to the admin dashboard!',
          });
          navigate('/dashboard');
          return;
        }

        try {
          const { data } = await supabase
            .from('users')
            .select('role')
            .eq('id', result.user.id)
            .single();

          if (data && data.role === 'admin') {
            navigate('/dashboard');
            toast({
              title: 'Admin Login Successful',
              description: 'Welcome to the admin dashboard!',
            });
          } else {
            navigate('/candidate-dashboard');
            toast({
              title: 'Logged in',
              description: 'Welcome to your exam portal.',
            });
          }
        } catch (error) {
          console.error('Error checking role:', error);

          if (isAdminEmail) {
            navigate('/dashboard');
          } else {
            navigate('/candidate-dashboard');
          }

          toast({
            title: 'Login successful',
            description: 'You have been logged in.',
          });
        }
      } else if (mode === 'register') {
        try {
          const { error: candidateError } = await supabase
            .from('candidates')
            .insert({
              name: fullName,
              unit: unit,
              email: email,
              status: 'pending',
            });

          // Ignore duplicate email errors (23505) — candidate already exists
          if (candidateError && candidateError.code !== '23505') {
            throw candidateError;
          }
        } catch (error) {
          console.error('Error saving candidate information:', error);
          toast({
            title: 'Registration error',
            description: 'Failed to save candidate information. Please try again.',
            variant: 'destructive',
          });
          return;
        }

        result = await signUp(email, password, {
          full_name: fullName,
          unit: unit,
          emailRedirectTo: `${window.location.origin}/auth`,
        });

        if (result) {
          toast({
            title: 'Registration successful',
            description: 'Your account has been created. Please sign in.',
          });

          // Switch back to login mode so the user can sign in
          setMode('login');
          setPassword('');
          setFullName('');
          setUnit('');

          try {
            if (result.user) {
              const role = isAdminEmail ? 'admin' : 'candidate';

              await supabase.from('users').upsert({
                id: result.user.id,
                email: email,
                role: role,
                full_name: fullName,
                unit: unit,
                verified: false,
              });

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
      const message = String((error as { message?: string })?.message || '').trim();
      toast({
        title: 'Authentication error',
        description: message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setUnit('');
  };

  const switchToForgotPassword = () => {
    setMode('forgot');
    setPassword('');
    setConfirmPassword('');
  };

  const switchToLogin = () => {
    setMode('login');
    setPassword('');
    setConfirmPassword('');
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const requiresEmail = mode === 'login' || mode === 'register' || mode === 'forgot';
  const submitDisabled =
    isLoading ||
    (requiresEmail && !emailRegex.test(email)) ||
    (mode === 'login' && !password) ||
    (mode === 'register' && (!fullName || !unit || !password)) ||
    (mode === 'forgot' && !email) ||
    (mode === 'reset' && (!password || !confirmPassword || password !== confirmPassword));

  // Email confirmation is disabled — verification screen removed

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          {mode === 'login'
            ? 'Sign In to Excelerate'
            : mode === 'register'
              ? 'Create Account'
              : mode === 'forgot'
                ? 'Reset Password'
                : 'Set New Password'}
        </CardTitle>
        <CardDescription className="text-center">
          {mode === 'login'
            ? 'Enter your credentials to access your account'
            : mode === 'register'
              ? 'Create your account with any email address'
              : mode === 'forgot'
                ? 'Enter your email to receive a reset link'
                : 'Enter and confirm your new password'}
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
                  Unit
                </label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select your unit" />
                  </SelectTrigger>
                  <SelectContent side="bottom" align="start" sideOffset={4} collisionPadding={12} className="max-h-60">
                    {ONBOARDING_UNITS.map((unitOption) => (
                      <SelectItem key={unitOption} value={unitOption}>
                        {unitOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {mode !== 'reset' && (
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
          )}

          {mode !== 'forgot' && (
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                {mode === 'reset' ? 'New Password' : 'Password'}
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="********"
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
              {mode === 'login' && (
                <div className="flex justify-end">
                  <Button type="button" variant="link" className="h-auto p-0" onClick={switchToForgotPassword}>
                    Forgot password?
                  </Button>
                </div>
              )}
            </div>
          )}

          {mode === 'reset' && (
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm New Password
              </label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="********"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90"
            disabled={submitDisabled}
          >
            {isLoading
              ? 'Processing...'
              : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                  ? 'Sign up'
                  : mode === 'forgot'
                    ? 'Send Reset Link'
                    : 'Update Password'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        {mode === 'login' && (
          <Button variant="link" onClick={toggleMode}>
            Sign up
          </Button>
        )}
        {mode === 'register' && (
          <Button variant="link" onClick={switchToLogin}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <Button variant="link" onClick={switchToLogin}>
            Back to Sign In
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
