
import { createClient } from '@supabase/supabase-js';
import { toast } from '@/components/ui/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

// Function to check if email is from allowed domain - now allowing all domains
export const isAllowedDomain = (email: string): boolean => {
  return true; // Allow all email domains
};

// Authentication helpers
export const signUp = async (email: string, password: string, metadata?: { full_name?: string; unit?: string; emailRedirectTo?: string }) => {
  // Email domain validation removed - all domains now allowed

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {},
        emailRedirectTo: metadata?.emailRedirectTo || `${window.location.origin}/auth`
      }
    });

    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    // After successful signup, add or update user in users table
    if (data.user) {
      try {
        // Default role is 'candidate' for all new users
        // Special case for certain admin emails
        const isAdminEmail = email === 'ameh.oche@babbangona.com';
        
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            full_name: metadata?.full_name || null,
            unit: metadata?.unit || null,
            role: isAdminEmail ? 'admin' : 'candidate', // Set role based on email
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error('Error creating user profile:', profileError);
        }
        
        // If admin, ensure admin_permissions record exists
        if (isAdminEmail) {
          try {
            const { error: adminError } = await supabase
              .from('admin_permissions')
              .upsert({
                user_id: data.user.id,
                can_grant_admin: true,
                updated_at: new Date().toISOString(),
              });
              
            if (adminError) {
              console.error('Error setting admin permissions:', adminError);
            }
          } catch (err) {
            console.error('Error in admin permissions setup:', err);
          }
        }
      } catch (err) {
        console.error('Error in user profile creation:', err);
      }
    }

    return data;
  } catch (err) {
    console.error('Sign up error:', err);
    toast({
      title: "Registration error",
      description: "An unexpected error occurred during registration.",
      variant: "destructive",
    });
    return null;
  }
};

export const signIn = async (email: string, password: string) => {
  // Email domain validation removed - all domains now allowed

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    toast({
      title: "Login failed",
      description: error.message,
      variant: "destructive",
    });
    return null;
  }

  // After successful login, add or update user in users table if needed
  try {
    // Check if the user already has a role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, full_name, unit')
      .eq('id', data.user.id)
      .single();

    if (userError && userError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error checking user role:', userError);
    }

    // Special case for admin email
    const isAdminEmail = email === 'ameh.oche@babbangona.com';
    const role = isAdminEmail ? 'admin' : (userData?.role || 'candidate');
    
    // Extract metadata from auth if available
    const fullName = data.user.user_metadata?.full_name || userData?.full_name || null;
    const unit = data.user.user_metadata?.unit || userData?.unit || null;
    
    // Update the user record
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
        unit: unit,
        role: role,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Error updating user profile:', profileError);
    }
    
    // Ensure admin permissions for admin users
    if (role === 'admin') {
      try {
        const { error: adminError } = await supabase
          .from('admin_permissions')
          .upsert({
            user_id: data.user.id,
            can_grant_admin: isAdminEmail, // Only default admin can grant admin by default
            updated_at: new Date().toISOString(),
          });
          
        if (adminError) {
          console.error('Error setting admin permissions:', adminError);
        }
      } catch (err) {
        console.error('Error in admin permissions setup:', err);
      }
    }
  } catch (err) {
    console.error('Error in user profile update:', err);
  }

  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    toast({
      title: "Sign out failed",
      description: error.message,
      variant: "destructive",
    });
    return false;
  }
  
  return true;
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getSession();
  
  if (error || !data.session) {
    return null;
  }
  
  return data.session.user;
};

// Types
export interface User {
  id: string;
  email: string;
  role?: string;
  user_group?: string;
  full_name?: string;
  assigned_test_type?: string;
  location?: string;
  verified?: boolean;
  created_at?: string;
  updated_at?: string;
  unit?: string;
}

export interface Candidate {
  id: string;
  name: string;
  unit: string;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[]; // Explicitly defined as string array
  correct_answer: string;
  category: string;
  difficulty: string;
  test_type?: string;
  points: number;
  created_at: string;
  updated_at: string;
}

export interface Test {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  passing_percentage: number;
  question_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  groups: string[];
  test_type?: string;
}

export interface TestAssignment {
  id: string;
  user_id: string;
  test_id: string;
  question_count: number;
  is_active: boolean;
  assigned_by?: string | null;
  assigned_via: 'unit' | 'csv' | 'migration' | 'manual';
  source_unit?: string | null;
  source_file_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestSubmission {
  id: string;
  assignment_id?: string | null;
  test_id: string;
  question_ids?: string[] | null;
  user_id: string;
  start_time: string;
  end_time?: string;
  answers?: Record<string, string>;
  score?: number;
  total_points?: number;
  passed?: boolean;
  violations_count?: number;
  status: 'in_progress' | 'completed' | 'expired';
  auto_submit?: boolean;
  created_at: string;
  user?: User;
  users?: User; // Support for different join name
  test?: Test;
  tests?: Test; // Support for different join name
}

export interface Violation {
  type: 'tab_switch' | 'right_click' | 'copy' | 'print_screen';
  timestamp: string;
  count?: number;
}

export interface AdminPermission {
  id: string;
  user_id: string;
  can_grant_admin: boolean;
  created_at: string;
  updated_at: string;
}

// Helper function to check if a test submission exists
export const checkExistingSubmission = async (userId: string, testId: string) => {
  try {
    console.log(`Checking submission for userId: ${userId}, testId: ${testId}`);
    
    const { data, error } = await supabase
      .from('test_submissions')
      .select('id, status')
      .eq('test_id', testId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error checking existing submission:', error);
      return null;
    }
    
    console.log('Existing submission check result:', data);
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('Error in checkExistingSubmission:', err);
    return null;
  }
};

// Helper function to create a new test submission
export const createTestSubmission = async (userId: string, testId: string) => {
  try {
    console.log(`Creating submission for userId: ${userId}, testId: ${testId}`);
    
    const { data, error } = await supabase
      .from('test_submissions')
      .insert({
        test_id: testId,
        user_id: userId,
        start_time: new Date().toISOString(),
        status: 'in_progress'
      })
      .select();
    
    if (error) {
      console.error('Error creating test submission:', error);
      return null;
    }
    
    console.log('New submission created:', data);
    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('Error in createTestSubmission:', err);
    return null;
  }
};

export { supabase };
