-- Fix RLS issues for storage objects (the policies require RLS to be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Enable RLS on any remaining tables that need it
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- The security issues about views and functions are existing ones from the codebase
-- and don't need to be fixed for this new course builder feature to work