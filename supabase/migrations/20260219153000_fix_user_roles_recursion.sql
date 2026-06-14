
-- ============================================================
-- FIX: Infinite Recursion in user_roles Policy
-- ============================================================

-- 1. Create a secure function to check roles without recursion
-- This function runs as the database owner (SECURITY DEFINER), 
-- bypassing RLS on user_roles during its execution.
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'manager')
  );
END;
$$;

-- 2. Drop the problematic recursive policy
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- 3. Create the new policy using the secure function
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (
    public.is_admin_or_manager()
  );

-- 4. Update other policies to use this function for better performance/security
-- (Optional but recommended for consistency)
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;

CREATE POLICY "Admins can manage services"
  ON public.services FOR ALL
  TO authenticated
  USING (
    public.is_admin_or_manager()
  );
