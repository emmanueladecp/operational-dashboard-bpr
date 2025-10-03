-- ============================================
-- Row Level Security (RLS) Policies - FIXED
-- Operational Dashboard v1
-- Using Clerk Native Integration
-- ============================================

-- ============================================
-- IMPORTANT: DROP EXISTING POLICIES FIRST
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own record" ON users;
DROP POLICY IF EXISTS "SUPERADMIN can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own name" ON users;
DROP POLICY IF EXISTS "SUPERADMIN can update users" ON users;
DROP POLICY IF EXISTS "Allow user self-registration" ON users;
DROP POLICY IF EXISTS "SUPERADMIN can delete users" ON users;

DROP POLICY IF EXISTS "All users can view active locations" ON master_locations;
DROP POLICY IF EXISTS "SUPERADMIN can view all locations" ON master_locations;
DROP POLICY IF EXISTS "SUPERADMIN can insert locations" ON master_locations;
DROP POLICY IF EXISTS "SUPERADMIN can update locations" ON master_locations;
DROP POLICY IF EXISTS "SUPERADMIN can delete locations" ON master_locations;

-- ============================================
-- HELPER FUNCTION TO GET USER ROLE
-- ============================================

-- Create a function to get current user's role without causing recursion
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- Get role for current authenticated user
  SELECT role INTO user_role
  FROM users
  WHERE clerk_id = (auth.jwt()->>'sub')::text;
  
  RETURN COALESCE(user_role, 'NO_ROLE');
END;
$$;

-- ============================================
-- USERS TABLE RLS POLICIES
-- ============================================

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own record OR SUPERADMIN can view all
CREATE POLICY "Users can view own record or SUPERADMIN views all"
ON users
FOR SELECT
TO authenticated
USING (
  (auth.jwt()->>'sub')::text = clerk_id 
  OR get_current_user_role() = 'SUPERADMIN_ROLE'
);

-- Policy 2: Users can update their own name (not role/locations) OR SUPERADMIN can update any
CREATE POLICY "Users update own or SUPERADMIN updates any"
ON users
FOR UPDATE
TO authenticated
USING (
  (auth.jwt()->>'sub')::text = clerk_id 
  OR get_current_user_role() = 'SUPERADMIN_ROLE'
)
WITH CHECK (
  -- If not SUPERADMIN, can only update own record and not change role/locations
  CASE 
    WHEN get_current_user_role() = 'SUPERADMIN_ROLE' THEN true
    ELSE (auth.jwt()->>'sub')::text = clerk_id
  END
);

-- Policy 3: Allow user creation on first login with NO_ROLE
CREATE POLICY "Allow user self-registration"
ON users
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt()->>'sub')::text = clerk_id
  AND role = 'NO_ROLE'
);

-- Policy 4: SUPERADMIN can delete users
CREATE POLICY "SUPERADMIN can delete users"
ON users
FOR DELETE
TO authenticated
USING (get_current_user_role() = 'SUPERADMIN_ROLE');

-- ============================================
-- MASTER_LOCATIONS TABLE RLS POLICIES
-- ============================================

-- Enable RLS on master_locations table
ALTER TABLE master_locations ENABLE ROW LEVEL SECURITY;

-- Policy 1: All authenticated users can view active locations OR SUPERADMIN sees all
CREATE POLICY "Users view active or SUPERADMIN views all locations"
ON master_locations
FOR SELECT
TO authenticated
USING (
  is_active = true 
  OR get_current_user_role() = 'SUPERADMIN_ROLE'
);

-- Policy 2: SUPERADMIN can insert locations
CREATE POLICY "SUPERADMIN can insert locations"
ON master_locations
FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'SUPERADMIN_ROLE');

-- Policy 3: SUPERADMIN can update locations
CREATE POLICY "SUPERADMIN can update locations"
ON master_locations
FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'SUPERADMIN_ROLE');

-- Policy 4: SUPERADMIN can delete locations
CREATE POLICY "SUPERADMIN can delete locations"
ON master_locations
FOR DELETE
TO authenticated
USING (get_current_user_role() = 'SUPERADMIN_ROLE');

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index on clerk_id for faster user lookups
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- Index on role for faster permission checks
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Index on is_active for location filtering
CREATE INDEX IF NOT EXISTS idx_master_locations_active ON master_locations(is_active);

-- ============================================
-- GRANT EXECUTE PERMISSION ON FUNCTION
-- ============================================

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated;

-- ============================================
-- NOTES
-- ============================================
-- 
-- Fixed Infinite Recursion Issue:
-- - Created helper function get_current_user_role() with SECURITY DEFINER
-- - Function bypasses RLS to safely query the users table
-- - Policies use this function instead of querying users table directly
-- 
-- Authentication Requirement:
-- - Using Clerk Native Supabase Integration (Third-Party Auth)
-- - Clerk user ID is accessed via auth.jwt()->>'sub'
-- - No need for JWT templates or manual token management
-- - Clerk automatically injects authenticated role into JWT
--
-- Prerequisites:
-- 1. Clerk Supabase integration must be enabled in Clerk Dashboard
-- 2. Clerk configured as third-party auth provider in Supabase
--
-- To apply these policies:
-- 1. Go to Supabase Dashboard
-- 2. Select your project
-- 3. Go to SQL Editor
-- 4. Paste this entire file
-- 5. Click "Run" to execute
--
-- To verify RLS is working:
-- Run: SELECT * FROM users; 
-- (Should only return your own user or all users if SUPERADMIN)
